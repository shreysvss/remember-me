using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace RememberMe.Pages;

[Authorize]
public class CalendarModel : PageModel
{
    public void OnGet() { }
}
