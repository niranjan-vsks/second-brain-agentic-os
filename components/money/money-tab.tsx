"use client"

import { useState, useTransition } from "react"
import useSWR from "swr"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  getAutopays,
  getPaymentInstruments,
  addAutopay,
  addPaymentInstrument,
  requestCancellation,
  updateAutopayStatus,
  deleteAutopay,
  deletePaymentInstrument,
  getCalendarConnectionStatus,
  disconnectCalendar,
} from "@/app/actions/money"
import { Plus, Trash2, ShieldAlert, CalendarCheck, CreditCard, IndianRupee, Ban } from "lucide-react"

const STATUS_STYLES: Record<string, string> = {
  active: "bg-primary/10 text-primary",
  cancel_requested: "bg-destructive/10 text-destructive",
  cancelled: "bg-muted text-muted-foreground line-through",
  paused: "bg-secondary text-secondary-foreground",
}

export function MoneyTab() {
  const { data: pays, mutate: mutatePays } = useSWR("money-autopays", () => getAutopays())
  const { data: instruments, mutate: mutateInst } = useSWR("money-instruments", () => getPaymentInstruments())
  const { data: calendar, mutate: mutateCal } = useSWR("calendar-status", () => getCalendarConnectionStatus())
  const [isPending, startTransition] = useTransition()

  // Add-autopay dialog state
  const [payOpen, setPayOpen] = useState(false)
  const [merchant, setMerchant] = useState("")
  const [rail, setRail] = useState("upi_mandate")
  const [amount, setAmount] = useState("")
  const [cadence, setCadence] = useState("monthly")
  const [nextDate, setNextDate] = useState("")
  const [instrumentId, setInstrumentId] = useState("")

  // Add-instrument dialog state
  const [instOpen, setInstOpen] = useState(false)
  const [label, setLabel] = useState("")
  const [instType, setInstType] = useState("debit_card")
  const [issuer, setIssuer] = useState("")
  const [lastFour, setLastFour] = useState("")

  const [playbookShown, setPlaybookShown] = useState<string | null>(null)

  const monthlyTotal = (pays ?? [])
    .filter((p) => p.status === "active" && p.amountINR)
    .reduce((sum, p) => {
      const amt = Number(p.amountINR)
      if (p.cadence === "monthly") return sum + amt
      if (p.cadence === "weekly") return sum + amt * 4.33
      if (p.cadence === "quarterly") return sum + amt / 3
      if (p.cadence === "yearly") return sum + amt / 12
      return sum
    }, 0)

  return (
    <div className="flex flex-col gap-4">
      {/* Security banner + calendar connection */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="flex items-start gap-3 p-4">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <p className="font-mono text-xs leading-relaxed text-muted-foreground">
              Zero-credential design: this tab stores only labels and last-4 digits — never full card numbers, PINs, or
              bank logins. No consumer API can cancel mandates in India, so cancellation is playbook-driven: Jarvis flags
              the autopay and gives you the exact per-bank steps.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3">
              <CalendarCheck className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div className="flex flex-col">
                <span className="text-sm font-medium">Google Calendar</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {calendar?.status === "connected"
                    ? `Connected${calendar.accountEmail ? ` — ${calendar.accountEmail}` : ""} (Jarvis can manage events)`
                    : "Not connected — Jarvis calendar tools disabled"}
                </span>
              </div>
            </div>
            {calendar?.status === "connected" ? (
              <Button
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    await disconnectCalendar()
                    mutateCal()
                  })
                }
              >
                Disconnect
              </Button>
            ) : (
              <Button size="sm" onClick={() => (window.location.href = "/api/auth/google-calendar/start")}>
                Connect
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Autopays */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex flex-col gap-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <IndianRupee className="size-4" aria-hidden="true" />
              Autopays
            </CardTitle>
            <span className="font-mono text-xs text-muted-foreground">
              {monthlyTotal > 0 ? `~₹${Math.round(monthlyTotal).toLocaleString("en-IN")}/month across active autopays` : "Track every mandate so nothing charges silently."}
            </span>
          </div>
          <Dialog open={payOpen} onOpenChange={setPayOpen}>
            <DialogTrigger render={<Button size="sm" />}>
              <Plus className="size-4" aria-hidden="true" />
              Add Autopay
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add Autopay</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ap-merchant">Merchant</Label>
                  <Input id="ap-merchant" value={merchant} onChange={(e) => setMerchant(e.target.value)} placeholder="Netflix, Jio, gym…" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label>Rail</Label>
                    <Select value={rail} onValueChange={(v) => setRail(v ?? "upi_mandate")}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="upi_mandate">UPI mandate</SelectItem>
                        <SelectItem value="card_si">Card SI</SelectItem>
                        <SelectItem value="enach">e-NACH</SelectItem>
                        <SelectItem value="wallet">Wallet</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="ap-amount">Amount (INR)</Label>
                    <Input id="ap-amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="499" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label>Cadence</Label>
                    <Select value={cadence} onValueChange={(v) => setCadence(v ?? "monthly")}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                        <SelectItem value="adhoc">Ad hoc</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="ap-next">Next charge</Label>
                    <Input id="ap-next" type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Instrument</Label>
                  <Select value={instrumentId || "none"} onValueChange={(v) => setInstrumentId(!v || v === "none" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None / unknown</SelectItem>
                      {instruments?.map((i) => (
                        <SelectItem key={i.id} value={i.id}>{i.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  disabled={isPending || !merchant.trim()}
                  onClick={() =>
                    startTransition(async () => {
                      await addAutopay({ merchant, rail, amountINR: amount || undefined, cadence, nextChargeDate: nextDate || undefined, instrumentId: instrumentId || undefined })
                      setMerchant(""); setAmount(""); setNextDate(""); setInstrumentId(""); setPayOpen(false)
                      mutatePays()
                    })
                  }
                >
                  Save
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {(!pays || pays.length === 0) && (
            <p className="py-6 text-center font-mono text-xs text-muted-foreground">
              No autopays tracked yet. Add your subscriptions and mandates — the daily cron reminds you before each charge.
            </p>
          )}
          {pays?.map((p) => {
            const inst = instruments?.find((i) => i.id === p.instrumentId)
            return (
              <div key={p.id} className="flex flex-col gap-2 rounded-md border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{p.merchant}</span>
                    <Badge className={STATUS_STYLES[p.status] ?? ""} variant="outline">{p.status.replace("_", " ")}</Badge>
                    <Badge variant="secondary">{p.rail.replace("_", " ")}</Badge>
                    {p.amountINR && <span className="font-mono text-xs text-muted-foreground">₹{Number(p.amountINR).toLocaleString("en-IN")} / {p.cadence}</span>}
                    {p.nextChargeDate && <span className="font-mono text-xs text-muted-foreground">next: {p.nextChargeDate}</span>}
                    {inst && <span className="font-mono text-xs text-muted-foreground">via {inst.label}</span>}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {p.status === "active" && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isPending}
                        onClick={() =>
                          startTransition(async () => {
                            const res = await requestCancellation(p.id)
                            setPlaybookShown(p.id)
                            mutatePays()
                            void res
                          })
                        }
                      >
                        <Ban className="size-3.5" aria-hidden="true" />
                        Cancel this
                      </Button>
                    )}
                    {p.status === "cancel_requested" && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isPending}
                        onClick={() =>
                          startTransition(async () => {
                            await updateAutopayStatus(p.id, "cancelled")
                            mutatePays()
                          })
                        }
                      >
                        Mark cancelled
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${p.merchant} autopay`}
                      disabled={isPending}
                      onClick={() =>
                        startTransition(async () => {
                          await deleteAutopay(p.id)
                          mutatePays()
                        })
                      }
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
                {(p.status === "cancel_requested" || playbookShown === p.id) && p.cancellationNotes && (
                  <div className="rounded-md bg-muted/40 p-2.5">
                    <p className="font-mono text-xs leading-relaxed text-muted-foreground">{p.cancellationNotes}</p>
                  </div>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Payment instruments */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="size-4" aria-hidden="true" />
            Payment Instruments
          </CardTitle>
          <Dialog open={instOpen} onOpenChange={setInstOpen}>
            <DialogTrigger render={<Button size="sm" variant="outline" />}>
              <Plus className="size-4" aria-hidden="true" />
              Add Instrument
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add Payment Instrument</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-3">
                <p className="font-mono text-xs text-muted-foreground">Metadata only — label, issuer, last 4. Never full numbers.</p>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="pi-label">Label</Label>
                  <Input id="pi-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="HDFC Debit, Tata Neu Infinity CC…" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label>Type</Label>
                    <Select value={instType} onValueChange={(v) => setInstType(v ?? "debit_card")}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="debit_card">Debit card</SelectItem>
                        <SelectItem value="credit_card">Credit card</SelectItem>
                        <SelectItem value="upi">UPI</SelectItem>
                        <SelectItem value="bank_account">Bank account</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="pi-issuer">Issuer</Label>
                    <Input id="pi-issuer" value={issuer} onChange={(e) => setIssuer(e.target.value)} placeholder="HDFC, Kotak, SBI…" />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="pi-lastfour">Last 4 digits (optional)</Label>
                  <Input id="pi-lastfour" value={lastFour} maxLength={4} onChange={(e) => setLastFour(e.target.value.replace(/\D/g, ""))} placeholder="1234" />
                </div>
                <Button
                  disabled={isPending || !label.trim()}
                  onClick={() =>
                    startTransition(async () => {
                      await addPaymentInstrument({ label, instrumentType: instType, issuer, lastFour })
                      setLabel(""); setIssuer(""); setLastFour(""); setInstOpen(false)
                      mutateInst()
                    })
                  }
                >
                  Save
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {(!instruments || instruments.length === 0) && (
            <p className="py-4 text-center font-mono text-xs text-muted-foreground">
              Add your cards/UPI handles (metadata only) so autopays can be linked to the right bank playbook.
            </p>
          )}
          {instruments?.map((i) => (
            <div key={i.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">{i.label}</span>
                <Badge variant="secondary">{i.instrumentType.replace("_", " ")}</Badge>
                {i.issuer && <span className="font-mono text-xs text-muted-foreground">{i.issuer}</span>}
                {i.lastFour && <span className="font-mono text-xs text-muted-foreground">•••• {i.lastFour}</span>}
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete ${i.label}`}
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    await deletePaymentInstrument(i.id)
                    mutateInst()
                  })
                }
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
