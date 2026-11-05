# Hotel Management System — Propel-style Redesign Prototype

A standalone, clickable prototype. It uses mock data only, needs no login or server, and leaves the original GitHub repository untouched.

## Inventory from the repository (source of truth)

**Roles:** Guest (not signed in), Customer, Receptionist, Service Staff, Operations Staff, Manager.
**Booking statuses:** Room held, Pending deposit, Confirmed, Checked in, Checked out, Cancelled, Expired.
**Room statuses:** Available, Occupied, Cleaning, Maintenance.

**Existing screens by role**
- Public / Guest: Home, Search rooms, Room details, Create booking (with hold countdown), Booking lookup, Payment return (VNPay), Login, Register, 404.
- Customer: My bookings, Booking detail, Edit or cancel a booking, Profile, Service orders (new, history, detail), Feedback (submit, my feedback), Report issue.
- Receptionist: Reception dashboard, Front desk (check-in and check-out), Booking list and detail, Walk-in booking, Guest search, Room status board, Payment reconciliation.
- Service Staff: Staff dashboard, Service order queue and detail, Assigned tasks.
- Operations Staff: Staff dashboard, Assigned tasks, Issues (list, detail), Report fault, Maintenance history, Equipment.
- Manager: Manager dashboard, Rooms, Room types, Amenities, Services, Accounts, Roles and permissions, Task queues (supervision), Revenue report, Operational report, Feedback review, Notifications.

## Design system
- Colors from the brief: #FAFBFC background, #110E0D text, #916C4D warm brown accent, #A2A19D neutral, #B3B6D4 lavender, #F5F2ED warm surface, white cards. Muted status colors for every booking and room status.
- Type: Instrument Serif for large public headings, DM Sans for everything else.
- Rounded cards, thin borders, soft shadows, editorial spacing, and generated hotel photography.

## Build phases (all in this project)
1. **Foundation:** design tokens, shared parts (public header and footer, dashboard sidebar and top bar, status badges, tables with search, filters and pagination, empty, loading and error states, dialogs, drawers, toasts), linked mock data (rooms, room types, guests, bookings, invoices, payments, service orders, tasks, issues, equipment, feedback, staff), and the floating **Prototype Role Switcher**.
2. **Public site and guest booking:** Propel-style homepage with a search bar (dates, guests), rooms search with filters, room detail with gallery, a multi-step booking flow (hold timer, guest details, deposit, simulated payment result), booking confirmation, booking lookup, login, register, unauthorized page and 404.
3. **Customer area:** dashboard, My bookings, booking detail with edit and cancel, service ordering, feedback, issue reporting, profile.
4. **Receptionist:** dashboard, front desk check-in and check-out that update booking and room status, booking management, walk-in booking, guest search, room status board, reconciliation.
5. **Service and Operations staff:** separate dashboards, task queues with status changes, service order handling, issues, fault reports, maintenance history, equipment.
6. **Manager:** KPI dashboard with charts, full create and edit for rooms, room types, amenities, services, accounts, roles and permissions; task supervision; revenue and operational reports; feedback review.
7. **Final pass:** mobile and tablet layouts, a check that every menu link opens a real screen, and polish.

Any screen not in the repository (for example a notifications center) gets an "Proposed UX" label.

## Technical details
- Separate pages for every screen. Shared pages use a pathless layout per area (public, account, staff, admin), with a sidebar menu filtered by the active role.
- In-memory store (Zustand) seeded from mock data, saved in the browser so status changes persist during a demo. Role switching changes the store's active role, which redirects to that role's start page.
- Use existing shadcn parts, recharts for charts, react-day-picker for dates, and sonner for toasts.
- No Lovable Cloud and no backend.
