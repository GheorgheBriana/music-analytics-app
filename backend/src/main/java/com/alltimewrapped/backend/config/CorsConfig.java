package com.alltimewrapped.backend.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

import java.util.Arrays;

@Configuration
public class CorsConfig {

    // Allows the React frontend to call backend API endpoints.
    // Using a CorsFilter bean is more robust than WebMvcConfigurer because it runs
    // at the Servlet Filter level, intercepting preflight requests before they reach the DispatcherServlet.
    @Bean
    public CorsFilter corsFilter() {
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        CorsConfiguration config = new CorsConfiguration();
        
        // Allow the React frontend origins (both localhost and 127.0.0.1)
        config.setAllowedOrigins(Arrays.asList("http://localhost:5173", "http://127.0.0.1:5173"));
        
        // Allow common HTTP methods including OPTIONS for preflight requests
        config.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));
        
        // Allow all headers
        config.setAllowedHeaders(Arrays.asList("*"));
        
        // Allow credentials (necessary when using headers or cookies in requests)
        config.setAllowCredentials(true);
        
        // Register configuration for all API paths
        source.registerCorsConfiguration("/api/**", config);
        
        return new CorsFilter(source);
    }
}