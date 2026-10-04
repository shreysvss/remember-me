# Remember Me

A reminder and gift-savings tracker for birthdays, anniversaries, date nights, or any occasion
worth remembering, built as an ASP.NET Core (C#) web app with Razor Pages, Entity Framework Core,
and a SQLite database.

## Opening it in Visual Studio

1. Make sure you have the **.NET 8 SDK** installed. Visual Studio 2022 (17.8+) includes it, or
   grab it from https://dotnet.microsoft.com/download/dotnet/8.0
2. Double-click `RememberMe.sln` to open the solution in Visual Studio.
3. Visual Studio will restore the two NuGet packages automatically
   (`Microsoft.EntityFrameworkCore.Sqlite` and `Microsoft.EntityFrameworkCore.Design`).
   If it doesn't, right-click the solution in Solution Explorer → **Restore NuGet Packages**.
4. Press **F5** (or the green Run arrow) to build and launch it.

The database file `occasions.db` is created automatically the first time the app runs — there's
no manual migration step. It appears next to the project files.

## What's inside

- `Program.cs` – app startup, cookie authentication, EF Core, and the background reminder service
- `Models/` – `AppUser`, `Occasion`, `Notification`
- `Data/AppDbContext.cs` – the EF Core database context
- `Pages/Account/` – Login and Register pages (passwords are hashed, never stored as plain text)
- `Pages/Index.cshtml` – the dashboard
- `Pages/Calendar.cshtml` – the week / month / year calendar
- `Controllers/` – JSON API endpoints the front-end JavaScript calls
  (`/api/occasions`, `/api/notifications`, `/api/settings`, `/api/share`, `/api/me`)
- `Pages/Share.cshtml` – the public page someone lands on when they open a shared link.
  No login is needed to view it; logging in or registering is only needed to add it to
  their own list.
- `Pages/Settings.cshtml` – change your username or password, pick a background colour
  (pink, blue, purple, green, yellow, orange, or red), and switch between light and dark mode.
  The choice is saved per account, so it's remembered next time you log in, and applies
  instantly without a page reload.
- `Services/OccasionNotificationService.cs` – runs in the background the whole time the app is
  running, and creates a reminder for each occasion that's 7, 3, or 1 day away (7 and 3 day
  reminders are opt-in per user, 1 day always fires). Reminders show up in the bell icon in the header.
- `wwwroot/css/site.css` – the candy styling, driven by CSS variables so the whole app can
  reskin to any of the seven colours in light or dark mode
- `wwwroot/js/site.js` – all the interactive behaviour (calendar, modals, carousel, toasts,
  confetti, sharing, settings)

## About sharing (group presents)

Open any occasion's detail view and click "Share." That generates a link like
`/Share/<token>` that anyone can open, no account needed, to see the name, date, notes, and the
present goal with how much has been saved so far. If they want their own reminders for that same
occasion, they log in or create an account and click "Add to my Remember Me," which copies it into
their own list as an independent entry they can track and contribute to on their own terms. It
isn't a live shared pot (each person's "saved so far" is separate), it's meant for "hey, don't
forget this one too, and here's what we're getting them."

## About the reminders

Reminders currently show up **inside the app** (the bell icon, with an unread badge). They are
generated for every user any time the app is running, so as long as the site is deployed
somewhere that stays running, everyone gets their reminders the next time they open the app.

If you'd like these to also arrive as an email or a push notification outside the app, that needs
an email service (like SMTP credentials or a provider such as SendGrid) or a push notification
service — happy to wire either of those in once you've picked one.

## Notes on this being a learning/first version

- Passwords are hashed with ASP.NET Core's built-in `PasswordHasher`, which is solid for a real
  app, but there's no "forgot password" flow yet.
- The site runs over HTTP in development and HTTPS in production by default (standard ASP.NET
  Core template behaviour).
- To move from SQLite to a bigger database later (e.g. SQL Server), you'd only need to change the
  connection string in `appsettings.json` and swap `UseSqlite` for `UseSqlServer` in `Program.cs`.
