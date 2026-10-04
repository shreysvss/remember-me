using RememberMe.Data;
using RememberMe.Models;
using Microsoft.EntityFrameworkCore;

namespace RememberMe.Services;

// Runs in the background for as long as the app is running and drops a Notification
// row into the database whenever an occasion is 7, 3, or 1 day away. The 1-day
// reminder always fires; the 7 and 3 day ones only fire for users who opted in.
public class OccasionNotificationService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<OccasionNotificationService> _logger;

    public OccasionNotificationService(IServiceScopeFactory scopeFactory, ILogger<OccasionNotificationService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await GenerateNotificationsAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to generate occasion reminder notifications");
            }

            // Checks on startup, then roughly twice a day - cheap, and safe to run
            // more than once since duplicate reminders for the same day are skipped.
            await Task.Delay(TimeSpan.FromHours(12), stoppingToken);
        }
    }

    private async Task GenerateNotificationsAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var today = DateTime.Today;
        var users = await db.Users.Include(u => u.Occasions).ToListAsync(ct);

        foreach (var user in users)
        {
            foreach (var b in user.Occasions)
            {
                var next = NextOccurrence(b.Month, b.Day, today);
                var daysAway = (next - today).Days;

                await MaybeCreate(db, user, b, daysAway, 1, "1-day", today);
                if (user.Notify3DaysBefore) await MaybeCreate(db, user, b, daysAway, 3, "3-day", today);
                if (user.Notify7DaysBefore) await MaybeCreate(db, user, b, daysAway, 7, "7-day", today);
            }
        }

        await db.SaveChangesAsync(ct);
    }

    private static async Task MaybeCreate(AppDbContext db, AppUser user, Occasion b, int daysAway, int target, string type, DateTime today)
    {
        if (daysAway != target) return;

        var alreadySent = await db.Notifications.AnyAsync(n =>
            n.UserId == user.Id && n.OccasionId == b.Id && n.Type == type && n.CreatedAt.Date == today);
        if (alreadySent) return;

        var when = target == 1 ? "tomorrow" : $"in {target} days";
        db.Notifications.Add(new Notification
        {
            UserId = user.Id,
            OccasionId = b.Id,
            Type = type,
            Message = $"{b.Name} is coming up {when} ({b.Month + 1}/{b.Day}).",
            CreatedAt = DateTime.UtcNow,
            IsRead = false
        });
    }

    private static DateTime NextOccurrence(int month, int day, DateTime today)
    {
        int ClampDay(int y, int m, int d) => Math.Min(d, DateTime.DaysInMonth(y, m));

        var year = today.Year;
        var candidate = new DateTime(year, month + 1, ClampDay(year, month + 1, day));
        if (candidate < today)
        {
            year += 1;
            candidate = new DateTime(year, month + 1, ClampDay(year, month + 1, day));
        }
        return candidate;
    }
}
