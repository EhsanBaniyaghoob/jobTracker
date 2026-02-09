import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { JobStatus } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

function normalizeStatus(input: unknown): JobStatus | null {
  const v = String(input ?? "").trim().toUpperCase();
  return (Object.values(JobStatus) as string[]).includes(v) ? (v as JobStatus) : null;
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    if (!id) return NextResponse.json({ error: "Missing job id" }, { status: 400 });

    const body = await req.json();

    const data: any = {};

    if (body.company !== undefined) data.company = String(body.company ?? "").trim();
    if (body.role !== undefined) data.role = String(body.role ?? "").trim();

    if (body.status !== undefined) {
      const st = normalizeStatus(body.status);
      if (st) data.status = st;
    }

    if (body.location !== undefined) data.location = body.location ? String(body.location).trim() : null;
    if (body.url !== undefined) data.url = body.url ? String(body.url).trim() : null;
    if (body.salary !== undefined) data.salary = body.salary ? String(body.salary).trim() : null;
    if (body.notes !== undefined) data.notes = body.notes ? String(body.notes).trim() : null;

    if (body.nextAction !== undefined) data.nextAction = body.nextAction ? String(body.nextAction).trim() : null;
    if (body.nextActionAt !== undefined) data.nextActionAt = body.nextActionAt ? new Date(body.nextActionAt) : null;

    if (data.company !== undefined && !data.company) {
      return NextResponse.json({ error: "Company cannot be empty" }, { status: 400 });
    }
    if (data.role !== undefined && !data.role) {
      return NextResponse.json({ error: "Role cannot be empty" }, { status: 400 });
    }

    const job = await prisma.job.update({ where: { id }, data });
    return NextResponse.json({ job });
  } catch (e) {
    console.error("PATCH /api/jobs/[id] failed:", e);
    return NextResponse.json({ error: "Failed to update job" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    if (!id) return NextResponse.json({ error: "Missing job id" }, { status: 400 });

    await prisma.job.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/jobs/[id] failed:", e);
    return NextResponse.json({ error: "Failed to delete job" }, { status: 500 });
  }
}