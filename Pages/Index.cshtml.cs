using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace RememberMe.Pages;

[Authorize]
public class IndexModel : PageModel
{
    public string CurrentUsername => User.Identity?.Name ?? "";

    public void OnGet() { }
}
