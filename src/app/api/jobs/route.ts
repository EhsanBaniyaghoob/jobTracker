import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { JobStatus } from "@prisma/client";

function normalizeStatus(input: unknown): JobStatus | null {
  const v = String(input ?? "").trim().toUpperCase();
  if (!v || v === "ALL") return null;
  return (Object.values(JobStatus) as string[]).includes(v) ? (v as JobStatus) : null;
}

function normalizeSort(input: unknown) {
  const v = String(input ?? "").trim();
  // allowed values
  const allowed = new Set([
    "updated_desc",
    "updated_asc",
    "created_desc",
    "created_asc",
    "company_asc",
    "company_desc",
  ]);
  return allowed.has(v) ? v : "updated_desc";
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  const status = normalizeStatus(url.searchParams.get("status"));
  const sort = normalizeSort(url.searchParams.get("sort"));

  const where = {
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { company: { contains: q, mode: "insensitive" as const } },
            { role: { contains: q, mode: "insensitive" as const } },
            { notes: { contains: q, mode: "insensitive" as const } },
            { nextAction: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const orderBy =
    sort === "updated_asc"
      ? { updatedAt: "asc" as const }
      : sort === "created_desc"
      ? { createdAt: "desc" as const }
      : sort === "created_asc"
      ? { createdAt: "asc" as const }
      : sort === "company_asc"
      ? { company: "asc" as const }
      : sort === "company_desc"
      ? { company: "desc" as const }
      : { updatedAt: "desc" as const };

  const jobs = await prisma.job.findMany({ where, orderBy });

  return NextResponse.json({ jobs });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const company = String(body.company ?? "").trim();
    const role = String(body.role ?? "").trim();

    if (!company || !role) {
      return NextResponse.json({ error: "Company and role are required" }, { status: 400 });
    }

    const status = normalizeStatus(body.status) ?? JobStatus.SAVED;

    const job = await prisma.job.create({
      data: {
        company,
        role,
        status,

        location: body.location ? String(body.location).trim() : null,
        url: body.url ? String(body.url).trim() : null,
        salary: body.salary ? String(body.salary).trim() : null,
        notes: body.notes ? String(body.notes).trim() : null,

        nextAction: body.nextAction ? String(body.nextAction).trim() : null,
        nextActionAt: body.nextActionAt ? new Date(body.nextActionAt) : null,
      },
    });

    return NextResponse.json({ job }, { status: 201 });
  } catch (e) {
    console.error("POST /api/jobs failed:", e);
    return NextResponse.json({ error: "Failed to create job" }, { status: 500 });
  }
}