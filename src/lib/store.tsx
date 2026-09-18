"use client";

/**
 * ที่เก็บข้อมูลฝั่ง client — รุ่น UI ล้วน (in-memory)
 *
 * สถาปัตยกรรม:
 *   หน้าจอ ──> useStore() ──> action ใน src/lib/db/*-actions.ts ──> ก้อน Db ในหน่วยความจำ
 *                   │
 *                   └──> อ่านจากก้อน Db ที่ clone มา (รูปทรงเดิม)
 *
 * การ "อ่าน" ใช้ก้อน Db ก้อนเดียว · การ "เขียน" ทุกจุดผ่าน action ที่แก้ก้อนนั้นแล้วโหลดใหม่
 * ⚠️ ไม่มีฐานข้อมูลจริง — รีเฟรชหน้าเว็บแล้วข้อมูลจะกลับไปเป็น seed ชุดเดิม
 */

import {
  createContext, useCallback, useContext, useMemo, useSyncExternalStore,
} from "react";
import {
  approveBookingsAction, cancelBookingAction,
  createBlackoutAction, createBookingAction, fetchDb, rejectBookingsAction,
  removeBlackoutAction, resetDemoDataAction, updateUnitAction,
  type CreateBookingPayload, type CreateBookingResult,
} from "./db/actions";
import {
  createBuildingAction, createSeriesAction, createTermAction,
  createUnitAction, deleteSeriesAction, deleteTermAction, fetchAuditLogsAction,
  previewSeriesAction, setUserRoleAction,
  updateTermAction, updateUnitDetailsAction,
  exportBookingsAction,
  type AuditFilter, type AuditRow,
  type BookingExportFilter, type BookingExportRow,
  type CreateBuildingInput, type CreateSeriesResult, type CreateUnitInput,
  type SeriesInput, type SeriesOccurrence, type TermInput, type UnitPatch,
} from "./db/admin-actions";
import { authStatusAction, logoutAction, type AuthStatus } from "./db/auth-actions";
import { getAttachmentBlob, putAttachment } from "./db/mockdb";
import { applyPolicySettings } from "./policy";
import type { Db, Role, User } from "./types";
import { todayKey } from "./time";

interface Snapshot {
  db: Db;
  /** ผู้ใช้ที่ล็อกอินอยู่ตามเซสชันจำลอง — null = ยังไม่ล็อกอิน */
  viewerId: string | null;
  auth: AuthStatus;
  today: string;
}

/* ---------------- external store ---------------- */

let snapshot: Snapshot | null = null;
let loadError: string | null = null;
let inFlight = 0;
let loadStarted = false;
const listeners = new Set<() => void>();

const emit = () => { for (const l of listeners) l(); };

async function load() {
  try {
    const [{ db, settings }, auth] = await Promise.all([fetchDb(), authStatusAction()]);
    applyPolicySettings(settings);
    snapshot = { db, viewerId: auth.user?.id ?? null, auth, today: todayKey() };
    loadError = null;
  } catch (err) {
    loadError = err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ";
  } finally {
    emit();
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (!loadStarted) {
    loadStarted = true;
    void load();
  }
  return () => { listeners.delete(cb); };
}

const getSnapshot = () => snapshot;
const getServerSnapshot = (): Snapshot | null => null;

/** ครอบทุก action: ตั้งสถานะกำลังทำงาน → เรียก action → โหลดข้อมูลใหม่ */
async function run<T>(fn: () => Promise<T>): Promise<T> {
  inFlight++;
  emit();
  try {
    return await fn();
  } finally {
    inFlight--;
    await load();
  }
}

/* ---------------- นาฬิกา (อัปเดตทุกนาที) ---------------- */

let nowIso = new Date().toISOString();
const clockListeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribeClock(cb: () => void) {
  clockListeners.add(cb);
  if (!timer) {
    timer = setInterval(() => {
      nowIso = new Date().toISOString();
      for (const l of clockListeners) l();
    }, 60_000);
  }
  return () => {
    clockListeners.delete(cb);
    if (clockListeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

const getClock = () => nowIso;
const getPending = () => inFlight > 0;

/* ---------------- ไฟล์แนบ (จำลองในหน่วยความจำ) ---------------- */

/**
 * รุ่นนี้ไม่มี route handler /api/attachments — เก็บไฟล์ไว้ใน Map ของหน่วยความจำแทน
 * ไฟล์จะหายเมื่อรีเฟรชหน้า (เพียงพอสำหรับการเดโม UI)
 */
async function uploadAttachment(file: File): Promise<UploadedAttachment> {
  return putAttachment(file);
}

async function fetchAttachment(attachmentId: string): Promise<Blob> {
  return getAttachmentBlob(attachmentId);
}

/* ---------------- React binding ---------------- */

export interface StoreActions {
  createBooking: (input: CreateBookingPayload) => Promise<CreateBookingResult>;
  approveBookings: (bookingIds: string[]) => Promise<void>;
  rejectBookings: (bookingIds: string[], reason: string) => Promise<void>;
  cancelBooking: (bookingId: string, byAdmin: boolean, reason: string) => Promise<void>;
  createBlackout: (
    unitId: string, startAt: string, endAt: string, reason: string,
  ) => Promise<{ ok: boolean; message?: string }>;
  removeBlackout: (blackoutId: string) => Promise<void>;
  updateUnit: (
    unitId: string,
    patch: { description?: string; contactNote?: string; capacity?: number; isBookable?: boolean },
  ) => Promise<void>;

  /* ---- ตารางประจำเทอม ---- */
  previewSeries: (input: SeriesInput) => Promise<{ occurrences: SeriesOccurrence[] }>;
  createSeries: (input: SeriesInput) => Promise<CreateSeriesResult>;
  deleteSeries: (seriesId: string) => Promise<void>;

  /* ---- จัดการห้อง และสิทธิ์ ---- */
  updateUnitDetails: (unitId: string, patch: UnitPatch) => Promise<void>;
  setUserRole: (userId: string, role: Role, grant: boolean) => Promise<void>;
  createBuilding: (input: CreateBuildingInput) => Promise<{ buildingId: string }>;
  createUnit: (input: CreateUnitInput) => Promise<{ unitId: string }>;

  /* ---- ภาคการศึกษา ---- */
  createTerm: (input: TermInput) => Promise<{ termId: string }>;
  updateTerm: (termId: string, input: TermInput) => Promise<void>;
  deleteTerm: (termId: string) => Promise<void>;

  /* ---- Audit log ---- */
  fetchAuditLogs: (filter?: AuditFilter) => Promise<AuditRow[]>;

  /* ---- ส่งออกรายการจอง ---- */
  exportBookings: (filter?: BookingExportFilter) => Promise<BookingExportRow[]>;

  /* ---- ไฟล์แนบ ---- */
  uploadAttachment: (file: File) => Promise<UploadedAttachment>;
  fetchAttachment: (attachmentId: string) => Promise<Blob>;
}

export interface UploadedAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
}

interface StoreValue {
  db: Db;
  /** วันที่วันนี้ตามเวลาไทย */
  today: string;
  /** เวลาปัจจุบันเป็น ISO — อัปเดตทุกนาที ใช้กับป้าย "ว่างตอนนี้" */
  nowIso: string;
  viewer: User | null;
  /** สถานะการล็อกอิน — ใช้กับเมนูบัญชีและหน้าเข้าสู่ระบบ */
  auth: AuthStatus;
  /** ออกจากระบบแล้วโหลดสถานะใหม่ */
  logout: () => Promise<void>;
  /** มี action กำลังทำงานอยู่หรือไม่ */
  pending: boolean;
  refresh: () => Promise<void>;
  reset: () => Promise<void>;
  actions: StoreActions;
}

const StoreCtx = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const clock = useSyncExternalStore(subscribeClock, getClock, getClock);
  const pending = useSyncExternalStore(subscribe, getPending, () => false);

  const logout = useCallback(async () => {
    await logoutAction();
    await load();
  }, []);

  const refresh = useCallback(() => load(), []);

  const actorId = snap?.viewerId ?? null;

  const actions = useMemo<StoreActions>(() => {
    const needActor = () => {
      if (!actorId) throw new Error("กรุณาเข้าสู่ระบบก่อนทำรายการ");
      return actorId;
    };
    return {
      createBooking: (input) =>
        run(() => createBookingAction(needActor(), input)),
      approveBookings: (ids) =>
        run(() => approveBookingsAction(needActor(), ids)),
      rejectBookings: (ids, reason) =>
        run(() => rejectBookingsAction(needActor(), ids, reason)),
      cancelBooking: (id, byAdmin, reason) =>
        run(() => cancelBookingAction(needActor(), id, byAdmin, reason)),
      createBlackout: (unitId, startAt, endAt, reason) =>
        run(() => createBlackoutAction(needActor(), unitId, startAt, endAt, reason)),
      removeBlackout: (blackoutId) =>
        run(() => removeBlackoutAction(needActor(), blackoutId)),
      updateUnit: (unitId, patch) =>
        run(() => updateUnitAction(needActor(), unitId, patch)),

      previewSeries: (input) => previewSeriesAction(needActor(), input),
      createSeries: (input) => run(() => createSeriesAction(needActor(), input)),
      deleteSeries: (seriesId) => run(() => deleteSeriesAction(needActor(), seriesId)),

      updateUnitDetails: (unitId, patch) =>
        run(() => updateUnitDetailsAction(needActor(), unitId, patch)),
      setUserRole: (userId, role, grant) =>
        run(() => setUserRoleAction(needActor(), userId, role, grant)),
      createBuilding: (input) => run(() => createBuildingAction(needActor(), input)),
      createUnit: (input) => run(() => createUnitAction(needActor(), input)),

      createTerm: (input) => run(() => createTermAction(needActor(), input)),
      updateTerm: (termId, input) => run(() => updateTermAction(needActor(), termId, input)),
      deleteTerm: (termId) => run(() => deleteTermAction(needActor(), termId)),

      fetchAuditLogs: (filter) => fetchAuditLogsAction(needActor(), filter ?? {}),
      exportBookings: (filter) => exportBookingsAction(needActor(), filter ?? {}),

      uploadAttachment: (file) => { needActor(); return uploadAttachment(file); },
      fetchAttachment: (attachmentId) => { needActor(); return fetchAttachment(attachmentId); },
    };
  }, [actorId]);

  const reset = useCallback(async () => {
    if (!actorId) return;
    await run(() => resetDemoDataAction(actorId));
  }, [actorId]);

  const value = useMemo<StoreValue | null>(() => {
    if (!snap) return null;
    return {
      db: snap.db,
      today: snap.today,
      nowIso: clock,
      viewer: snap.viewerId
        ? snap.db.users.find((u) => u.id === snap.viewerId) ?? null
        : null,
      auth: snap.auth,
      logout,
      pending,
      refresh,
      reset,
      actions,
    };
  }, [snap, clock, pending, logout, refresh, reset, actions]);

  if (!value) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-6">
        {loadError ? (
          <div className="max-w-md rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
            <p className="font-semibold text-rose-900">โหลดข้อมูลไม่สำเร็จ</p>
            <p className="mt-2 text-sm leading-relaxed text-rose-800">{loadError}</p>
            <button
              onClick={() => { loadStarted = true; void load(); }}
              className="mt-4 h-10 rounded-xl bg-rose-600 px-5 text-sm font-medium text-white transition hover:bg-rose-700"
            >
              ลองใหม่อีกครั้ง
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-brand-200 border-t-brand-600" />
            <p className="text-sm text-ink-400">กำลังโหลดข้อมูล…</p>
          </div>
        )}
      </div>
    );
  }

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useStore ต้องถูกเรียกภายใน <StoreProvider>");
  return ctx;
}
