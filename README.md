# AI Automation Platform for Fashion Brands — Interactive Demo

A polished, **brand-agnostic** product demo you can open in a web browser during a
client meeting, walk a fashion brand through realistic scenarios, and show how AI
automation solves their day-to-day problems.

Everything lives in a **single self-contained file**: [`index.html`](index.html).
No build step, no server, no dependencies — just open it in a browser.

## How to run

Double-click `index.html`, or open it in any modern browser. Works fully offline
(all product imagery is inline SVG, so nothing breaks on meeting-room wifi).

## What's inside

**7 modules** (left sidebar):
1. **Overview** — orders & inquiry summary, pending tasks, orders at risk, support performance, live AI activity
2. **AI Customer Inbox** — WhatsApp / website / Instagram in one place, customer + order context, AI-drafted replies, human handoff, summaries
3. **Order Management** — search / filter, production timeline, expected delivery, customer measurements, delay alerts
4. **AI Shopping Assistant** — conversational product discovery with recommendations by occasion / size / fabric / budget
5. **AI Voice Receptionist** — call history, transcripts & summaries, captured leads, after-hours & missed-call recovery, follow-ups
6. **Workflow Automation** — status notifications, follow-ups, rush-order qualification, booking, escalation rules (toggleable)
7. **Analytics** — AI-handled %, escalation rate, response time, leads, conversion, estimated time saved

**7 clickable demo scenarios** (top-right **Demo Scenarios** button) — each one
jumps to the right module and plays the interaction live:
product discovery · order status · after-hours call capture · delay alert ·
rush-order feasibility · styling-consult booking · human escalation.

## Reusing it for a specific client

Open **Brand Settings** (in-app) to change the brand name, logo initials, and
colors live — or edit the `CONFIG` object at the top of the `<script>` in
`index.html` to swap in a client's brand, channels, business rules (lead times,
rush surcharge, business hours) and product catalog.

## Important — this is a demonstration

All conversations, orders, calls and analytics are **realistic sample data**,
clearly labelled throughout (`DEMO DATA`, `simulated`, `sample analytics`).
Nothing is connected to live WhatsApp, payment, inventory or calendar systems —
those flows are simulated and would be connected in a real deployment.
