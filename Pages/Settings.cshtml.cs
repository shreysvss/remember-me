using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace RememberMe.Pages;

[Authorize]
public class SettingsModel : PageModel
{
    public void OnGet() { }
}
