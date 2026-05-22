package com.alltimewrapped.backend.admin.security;

import com.alltimewrapped.backend.model.AppUser;
import com.alltimewrapped.backend.model.UserRole;
import com.alltimewrapped.backend.repository.AppUserRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.util.Optional;

@Component
@RequiredArgsConstructor
public class AdminAuthInterceptor implements HandlerInterceptor {

    private final AppUserRepository appUserRepository;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        // Allow preflight CORS requests to pass through
        if (request.getMethod().equals("OPTIONS")) {
            return true;
        }

        String userIdHeader = request.getHeader("X-User-Id");
        
        if (userIdHeader == null || userIdHeader.isBlank()) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.getWriter().write("Missing X-User-Id header");
            return false;
        }

        try {
            Long userId = Long.parseLong(userIdHeader);
            Optional<AppUser> userOpt = appUserRepository.findById(userId);

            if (userOpt.isEmpty()) {
                response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                response.getWriter().write("User not found");
                return false;
            }

            AppUser user = userOpt.get();
            if (user.getRole() != UserRole.ADMIN) {
                response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                response.getWriter().write("Access Denied: Requires ADMIN role");
                return false;
            }

            return true;
        } catch (NumberFormatException e) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            response.getWriter().write("Invalid X-User-Id header");
            return false;
        }
    }
}
