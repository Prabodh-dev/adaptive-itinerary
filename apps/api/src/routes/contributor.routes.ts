import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import "@fastify/multipart";
import { db } from "@adaptive/store";
import { getCommunityDefaultTtlMin } from "../services/community-signals.service.js";
import { uploadImageToCloudinary } from "../services/cloudinary.service.js";

const ALLOWED_REPORT_TYPES = new Set(["weather", "traffic", "transit", "crowds", "closure"]);

function getContributorId(request: FastifyRequest): string | null {
  const contributorId = request.headers["x-contributor-id"];
  if (!contributorId) return null;
  if (Array.isArray(contributorId)) return contributorId[0] || null;
  return contributorId;
}

export async function registerContributorRoutes(app: FastifyInstance) {
  app.post(
    "/contributor/register",
    async (
      request: FastifyRequest<{ Body: { contributorId?: string; name?: string; contact?: string } }>,
      reply: FastifyReply
    ) => {
      const body = request.body || {};
      const contributorId = (body.contributorId || "").trim();
      const name = (body.name || "").trim();
      const contact = body.contact?.trim();

      if (!contributorId) {
        return reply.code(400).send({ error: "contributorId is required" });
      }
      if (!/^[a-zA-Z0-9_-]{4,64}$/.test(contributorId)) {
        return reply
          .code(400)
          .send({ error: "contributorId must be 4-64 chars and contain only letters, numbers, _ or -" });
      }
      if (!name) {
        return reply.code(400).send({ error: "name is required" });
      }

      const existing = await db.contributorProfile.findUnique({ where: { id: contributorId } });
      if (existing) {
        return reply.code(409).send({ error: "contributorId already exists. Choose a different ID." });
      }

      const profile = await db.contributorProfile.create({
        data: {
          id: contributorId,
          name,
          contact: contact || null,
        },
      });

      return reply.code(201).send({
        contributorId: profile.id,
        profile,
      });
    }
  );

  app.post("/contributor/reports", async (request: FastifyRequest, reply: FastifyReply) => {
    const contributorId = getContributorId(request);
    if (!contributorId) {
      return reply.code(401).send({ error: "Missing X-CONTRIBUTOR-ID header" });
    }

    const contributor = await db.contributorProfile.findUnique({ where: { id: contributorId } });
    if (!contributor) {
      return reply.code(401).send({ error: "Invalid contributor ID" });
    }
    if (contributor.isBanned) {
      return reply.code(403).send({ error: "Contributor is banned" });
    }

    let type = "";
    let severity = 0;
    let message = "";
    let lat = Number.NaN;
    let lng = Number.NaN;
    let locationText: string | undefined;
    let ttlMin: number | undefined;
    let photoUrl: string | undefined;

    const parts = (request as any).parts();
    for await (const part of parts) {
      if (part.type === "file") {
        if (part.filename) {
          if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_UPLOAD_PRESET) {
            return reply.code(400).send({
              error:
                "Photo upload is not configured. Set CLOUDINARY_CLOUD_NAME and CLOUDINARY_UPLOAD_PRESET, or submit without photo.",
            });
          }
          try {
            const fileBuffer = await part.toBuffer();
            photoUrl = await uploadImageToCloudinary(fileBuffer, part.filename);
          } catch (error) {
            return reply.code(400).send({
              error: error instanceof Error ? error.message : "Photo upload failed",
            });
          }
        }
        continue;
      }

      const value = String(part.value ?? "").trim();
      if (part.fieldname === "type") type = value;
      else if (part.fieldname === "severity") severity = Number.parseInt(value, 10);
      else if (part.fieldname === "message") message = value;
      else if (part.fieldname === "lat") lat = Number.parseFloat(value);
      else if (part.fieldname === "lng") lng = Number.parseFloat(value);
      else if (part.fieldname === "locationText") locationText = value || undefined;
      else if (part.fieldname === "ttlMin") ttlMin = Number.parseInt(value, 10);
    }

    if (!ALLOWED_REPORT_TYPES.has(type)) {
      return reply.code(400).send({ error: "Invalid type. Must be weather|traffic|transit|crowds|closure" });
    }
    if (!Number.isInteger(severity) || severity < 1 || severity > 5) {
      return reply.code(400).send({ error: "severity must be between 1 and 5" });
    }
    if (!message) {
      return reply.code(400).send({ error: "message is required" });
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return reply.code(400).send({ error: "lat and lng are required and must be valid numbers" });
    }

    const effectiveTtlMin =
      Number.isFinite(ttlMin) && (ttlMin as number) > 0 ? (ttlMin as number) : getCommunityDefaultTtlMin();
    const expiresAt = new Date(Date.now() + effectiveTtlMin * 60 * 1000);

    const report = await db.report.create({
      data: {
        contributorId,
        type,
        severity,
        message,
        lat,
        lng,
        locationText: locationText || null,
        photoUrl: photoUrl || null,
        status: "pending",
        expiresAt,
      },
    });

    return reply.code(201).send({
      reportId: report.id,
      status: "pending",
    });
  });

  app.get("/contributor/reports", async (request: FastifyRequest, reply: FastifyReply) => {
    const contributorId = getContributorId(request);
    if (!contributorId) {
      return reply.code(401).send({ error: "Missing X-CONTRIBUTOR-ID header" });
    }

    const reports = await db.report.findMany({
      where: { contributorId },
      orderBy: { createdAt: "desc" },
    });

    return reply.send({ reports });
  });

  app.get("/contributor/rewards", async (request: FastifyRequest, reply: FastifyReply) => {
    const contributorId = getContributorId(request);
    if (!contributorId) {
      return reply.code(401).send({ error: "Missing X-CONTRIBUTOR-ID header" });
    }

    const rewards = await db.rewardLedger.findMany({
      where: { contributorId },
      orderBy: { createdAt: "desc" },
    });

    const totalCredits = rewards.reduce((sum: number, reward: { amount: number }) => sum + reward.amount, 0);
    return reply.send({ rewards, totalCredits });
  });
}
