package es.fractalgamestudios.cubezon.roleplay;

import org.jetbrains.annotations.Nullable;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Optional;

/**
 * Links to the web (config.yml web.url), sent as clickable chat text: an inventory menu cannot open
 * a browser. Only http(s) addresses are used, so a bad config never produces another kind of link.
 */
public record WebLinks(String base) {

    /** The web's address, or empty when web.url is blank or not an http(s) URL. */
    public static Optional<WebLinks> of(@Nullable String url) {
        if (url == null || url.isBlank()) {
            return Optional.empty();
        }
        String trimmed = url.strip().replaceAll("/+$", "");
        try {
            URI uri = URI.create(trimmed);
            String scheme = uri.getScheme();
            if (uri.getHost() == null || !("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme))) {
                return Optional.empty();
            }
        } catch (IllegalArgumentException e) {
            return Optional.empty();
        }
        return Optional.of(new WebLinks(trimmed));
    }

    /** The shop's public page (only meaningful once the shop is approved). */
    public String storefront(String slug) {
        return base + "/t/" + encode(slug);
    }

    /** The shop's seller panel (the web asks to sign in). */
    public String panel(String slug) {
        return base + "/panel/" + encode(slug);
    }

    private static String encode(String slug) {
        return URLEncoder.encode(slug, StandardCharsets.UTF_8).replace("+", "%20");
    }
}
