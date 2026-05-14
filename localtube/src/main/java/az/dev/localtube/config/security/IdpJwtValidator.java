package az.dev.localtube.config.security;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import javax.net.ssl.*;
import java.security.SecureRandom;
import java.security.cert.X509Certificate;

/**
 * Validates RS256 JWTs issued by AO ID (auth.ao.az) using the JWKS endpoint.
 * Supports self-signed TLS certificates (configurable via localtube.idp.skip-ssl-verify).
 */
@Slf4j
@Component
public class IdpJwtValidator {

    private final JwtDecoder decoder;

    public IdpJwtValidator(
            @Value("${localtube.idp.jwks-uri}") String jwksUri,
            @Value("${localtube.idp.skip-ssl-verify:true}") boolean skipSslVerify) {

        NimbusJwtDecoder.JwkSetUriJwtDecoderBuilder builder =
                NimbusJwtDecoder.withJwkSetUri(jwksUri);

        if (skipSslVerify) {
            builder.restOperations(buildSslIgnoringRestTemplate());
            log.warn("IdpJwtValidator: SSL certificate verification DISABLED (skip-ssl-verify=true)");
        }

        this.decoder = builder.build();
        log.info("IdpJwtValidator initialized with JWKS URI: {}", jwksUri);
    }

    public Jwt validate(String token) {
        try {
            return decoder.decode(token);
        } catch (JwtException e) {
            log.debug("IDP JWT validation failed: {}", e.getMessage());
            return null;
        }
    }

    public OidcUserDetails toUserDetails(Jwt jwt) {
        // LDAP claim names from the IDP (Global Bank LDAP):
        //   mail        → email address
        //   cn          → full name (e.g. "Daniel Hernandez")
        //   givenName   → first name
        //   sn          → surname
        //   uid         → login username
        String email = firstNonNull(
                jwt.getClaimAsString("mail"),
                jwt.getClaimAsString("email"),
                jwt.getSubject()
        );

        String displayName = firstNonNull(
                jwt.getClaimAsString("cn"),           // full name preferred
                buildFullName(jwt.getClaimAsString("givenName"), jwt.getClaimAsString("sn")),
                jwt.getClaimAsString("uid"),
                jwt.getClaimAsString("display_name"),
                jwt.getClaimAsString("ldap_username")
        );

        log.debug("IDP claims — email(mail)={} cn={} givenName={} sn={} uid={}",
                jwt.getClaimAsString("mail"),
                jwt.getClaimAsString("cn"),
                jwt.getClaimAsString("givenName"),
                jwt.getClaimAsString("sn"),
                jwt.getClaimAsString("uid"));

        return new OidcUserDetails(email, displayName);
    }

    private static String firstNonNull(String... values) {
        for (String v : values) {
            if (v != null && !v.isBlank()) return v;
        }
        return null;
    }

    private static String buildFullName(String given, String sn) {
        if (given == null && sn == null) return null;
        if (sn == null) return given;
        if (given == null) return sn;
        return given + " " + sn;
    }

    private static RestTemplate buildSslIgnoringRestTemplate() {
        try {
            SSLContext sslContext = SSLContext.getInstance("TLS");
            sslContext.init(null, new TrustManager[]{new X509TrustManager() {
                public X509Certificate[] getAcceptedIssuers() { return new X509Certificate[0]; }
                public void checkClientTrusted(X509Certificate[] c, String a) {}
                public void checkServerTrusted(X509Certificate[] c, String a) {}
            }}, new SecureRandom());

            SSLSocketFactory sf = sslContext.getSocketFactory();
            HostnameVerifier hv = (host, session) -> true;

            SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory() {
                @Override
                protected void prepareConnection(java.net.HttpURLConnection conn, String method)
                        throws java.io.IOException {
                    if (conn instanceof HttpsURLConnection https) {
                        https.setSSLSocketFactory(sf);
                        https.setHostnameVerifier(hv);
                    }
                    super.prepareConnection(conn, method);
                }
            };

            return new RestTemplate(factory);
        } catch (Exception e) {
            throw new RuntimeException("Failed to build SSL-ignoring RestTemplate", e);
        }
    }
}
