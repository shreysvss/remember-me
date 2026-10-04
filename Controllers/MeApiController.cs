using Microsoft.AspNetCore.Mvc;

namespace RememberMe.Controllers;

[ApiController]
[Route("api/me")]
public class MeApiController : ControllerBase
{
    [HttpGet]
    public IActionResult Get()
    {
        if (User.Identity?.IsAuthenticated == true)
            return Ok(new { loggedIn = true, username = User.Identity.Name });

        return Ok(new { loggedIn = false });
    }
}
