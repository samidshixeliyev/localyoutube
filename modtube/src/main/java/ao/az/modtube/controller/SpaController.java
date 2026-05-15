package ao.az.modtube.controller;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;

/**
 * Forwards all non-API, non-static requests to index.html so React Router
 * handles client-side navigation (/, /login, /video/*, /logged_out, etc.)
 */
@Controller
public class SpaController {

    @RequestMapping(value = {
            "/",
            "/login",
            "/callback",
            "/logged_out",
            "/search",
            "/upload",
            "/my-videos",
            "/change-password",
            "/video/**",
            "/admin/**"
    })
    public String forwardToIndex(HttpServletRequest request) {
        return "forward:/index.html";
    }
}
