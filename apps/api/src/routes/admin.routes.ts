import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { db } from "@adaptive/store";
import { emit } from "../realtime/sseHub.js";
import {
  computeDefaultReward,
  getTripsAffectedByReport,
} from "../services/community-signals.service.js";
import { recomputeTripSuggestions } from "../services/recompute.service.js";

function isAdminAuthorized(request: FastifyRequest): boolean {
  const headerValue = request.headers["x-admin-key"];
  const key = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  return Boolean(key && process.env.ADMIN_REVIEW_KEY && key === process.env.ADMIN_REVIEW_KEY);
}

function rejectIfUnauthorized(request: FastifyRequest, reply: FastifyReply): boolean {
  if (!isAdminAuthorized(request)) {
    reply.code(401).send({ error: "Unauthorized admin key" });
    return true;
  }
  return false;
}

export async function registerAdminRoutes(app: FastifyInstance) {
  app.get(
    "/admin/reports",
    async (
      request: FastifyRequest<{
        Querystring: { status?: "pending" | "approved" | "rejected"; page?: string; pageSize?: string };
      }>,
      reply: FastifyReply
    ) => {
      if (rejectIfUnauthorized(request, reply)) return;

      const status = request.query.status;
      const page = Math.max(1, Number.parseInt(request.query.page || "1", 10) || 1);
      const pageSize = Math.min(100, Math.max(1, Number.parseInt(request.query.pageSize || "25", 10) || 25));
      const skip = (page - 1) * pageSize;

      const where = status ? { status } : undefined;
      const [reports, total] = await Promise.all([
        db.report.findMany({
          where,
          include: {
            contributor: {
              select: { id: true, name: true, trustScore: true, isBanned: true },
            },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: pageSize,
        }),
        db.report.count({ where }),
      ]);

      return reply.send({
        page,
        pageSize,
        total,
        reports,
      });
    }
  );

  app.post(
    "/admin/reports/:reportId/approve",
    async (
      request: FastifyRequest<{
        Params: { reportId: string };
        Body: { rewardAmount?: number; expiresAt?: string };
      }>,
      reply: FastifyReply
    ) => {
      if (rejectIfUnauthorized(request, reply)) return;

      const { reportId } = request.params;
      const body = request.body || {};
      const adminKey = request.headers["x-admin-key"];
      const reviewedBy = Array.isArray(adminKey) ? adminKey[0] : adminKey || "admin";

      const existing = await db.report.findUnique({ where: { id: reportId } });
      if (!existing) {
        return reply.code(404).send({ error: "Report not found" });
      }
      if (existing.status === "approved") {
        return reply.send({ ok: true, report: existing, note: "Already approved" });
      }

      const expiresAt = body.expiresAt ? new Date(body.expiresAt) : existing.expiresAt;
      if (Number.isNaN(expiresAt.getTime())) {
        return reply.code(400).send({ error: "Invalid expiresAt format" });
      }

      const rewardAmount =
        typeof body.rewardAmount === "number" && Number.isFinite(body.rewardAmount)
          ? Math.max(0, Math.floor(body.rewardAmount))
          : computeDefaultReward(existing.severity);

      const result = await db.$transaction(async (tx: any) => {
        const report = await tx.report.update({
          where: { id: reportId },
          data: {
            status: "approved",
            expiresAt,
            reviewedAt: new Date(),
            reviewedBy,
          },
        });

        const reward = await tx.rewardLedger.create({
          data: {
            reportId: report.id,
            contributorId: report.contributorId,
            amount: rewardAmount,
            status: "credited",
          },
        });

        const contributor = await tx.contributorProfile.update({
          where: { id: report.contributorId },
          data: {
            approvedCount: { increment: 1 },
            trustScore: { increment: 1 },
          },
        });

        return { report, reward, contributor };
      });

      const affectedTrips = await getTripsAffectedByReport({
        lat: result.report.lat,
        lng: result.report.lng,
      });

      for (const tripId of affectedTrips) {
        emit(tripId, "signal:update", {
          type: "community",
          reportId: result.report.id,
        });
        try {
          await recomputeTripSuggestions(tripId);
        } catch (error) {
          app.log.error({ error, tripId }, "Failed to recompute suggestions after community approval");
        }
      }

      return reply.send({
        ok: true,
        report: result.report,
        reward: result.reward,
        affectedTrips,
      });
    }
  );

  app.post(
    "/admin/reports/:reportId/reject",
    async (
      request: FastifyRequest<{ Params: { reportId: string }; Body: { reason?: string } }>,
      reply: FastifyReply
    ) => {
      if (rejectIfUnauthorized(request, reply)) return;

      const { reportId } = request.params;
      const body = request.body || {};
      const adminKey = request.headers["x-admin-key"];
      const reviewedBy = Array.isArray(adminKey) ? adminKey[0] : adminKey || "admin";

      const existing = await db.report.findUnique({ where: { id: reportId } });
      if (!existing) {
        return reply.code(404).send({ error: "Report not found" });
      }
      if (existing.status === "rejected") {
        return reply.send({ ok: true, report: existing, note: "Already rejected" });
      }

      const report = await db.report.update({
        where: { id: reportId },
        data: {
          status: "rejected",
          reviewedAt: new Date(),
          reviewedBy: body.reason ? `${reviewedBy}: ${body.reason}` : reviewedBy,
        },
      });

      const contributor = await db.contributorProfile.update({
        where: { id: report.contributorId },
        data: {
          rejectedCount: { increment: 1 },
          trustScore: { decrement: 1 },
        },
      });

      return reply.send({ ok: true, report, contributor });
    }
  );
}
