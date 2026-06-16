package ao.az.modtube.service;

import ao.az.modtube.entity.Role;
import ao.az.modtube.entity.User;
import ao.az.modtube.repository.RoleRepository;
import ao.az.modtube.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Auto-provisions IDP users in the local database on first login.
 * This makes IDP users visible to admins and allows role assignment.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class IdpUserProvisioningService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;

    /**
     * Backwards-compatible overload (no stable subject available).
     */
    @Transactional
    public User getOrCreate(String email, String displayName) {
        return getOrCreate(email, displayName, null);
    }

    /**
     * Resolves the DB user for an IDP login, matching by the stable {@code subject}
     * ('sub' claim) first so admin-assigned roles survive email changes, then falling
     * back to email for legacy rows provisioned before the idp_subject column existed.
     * Creates a new USER-role record on first login. The subject is persisted/backfilled
     * so all future logins match by it.
     */
    @Transactional
    public User getOrCreate(String email, String displayName, String subject) {
        // 1) Stable match by IDP subject — immune to email changes.
        if (subject != null && !subject.isBlank()) {
            var bySubject = userRepository.findByIdpSubject(subject);
            if (bySubject.isPresent()) {
                return syncNameIfChanged(bySubject.get(), displayName, email, subject);
            }
        }

        // 2) Legacy / first-login match by email — backfill the subject onto the row.
        var byEmail = userRepository.findUserByEmail(email);
        if (byEmail.isPresent()) {
            return syncNameIfChanged(byEmail.get(), displayName, email, subject);
        }

        // 3) New user.
        log.info("Auto-provisioning IDP user: email={} sub={}", email, subject);

        Role userRole = roleRepository.findByName("USER")
                .orElseGet(() -> roleRepository.findAll().stream()
                        .filter(r -> r.getName().equalsIgnoreCase("user"))
                        .findFirst()
                        .orElseThrow(() -> new RuntimeException(
                                "No USER role found — cannot provision IDP user")));

        String[] parts = splitName(displayName != null ? displayName : email.split("@")[0]);
        User user = new User();
        user.setName(parts[0]);
        user.setSurname(parts.length > 1 ? parts[1] : null);
        user.setEmail(email);
        user.setIdpSubject(subject);
        // Non-usable placeholder — IDP users never authenticate with password
        user.setPassword("{idp}" + UUID.randomUUID());
        user.setRole(userRole);
        user.setCreatedAt(LocalDateTime.now());
        user.setUpdatedAt(LocalDateTime.now());

        User saved = userRepository.save(user);
        log.info("IDP user provisioned: id={} email={} sub={}", saved.getId(), email, subject);
        return saved;
    }

    /** Syncs display name + backfills idp_subject if missing. */
    private User syncNameIfChanged(User existing, String displayName, String email, String subject) {
        boolean changed = false;

        String[] parts = splitName(displayName != null ? displayName : email);
        if (!parts[0].equals(existing.getName())) {
            existing.setName(parts[0]);
            changed = true;
        }
        String newSurname = parts.length > 1 ? parts[1] : null;
        if (!java.util.Objects.equals(newSurname, existing.getSurname())) {
            existing.setSurname(newSurname);
            changed = true;
        }
        // Backfill the stable subject on legacy rows so future logins match by it.
        if (subject != null && !subject.isBlank() && existing.getIdpSubject() == null) {
            existing.setIdpSubject(subject);
            changed = true;
        }

        if (changed) {
            existing.setUpdatedAt(LocalDateTime.now());
            userRepository.save(existing);
        }
        return existing;
    }

    /**
     * Splits a display name ("Daniel Hernandez") into [firstName, surname].
     * Returns ["User"] if blank.
     */
    private String[] splitName(String displayName) {
        if (displayName == null || displayName.isBlank()) return new String[]{"User"};
        // Split on first whitespace: "Daniel Hernandez" → ["Daniel", "Hernandez"]
        String[] parts = displayName.trim().split("\\s+", 2);
        return parts;
    }
}
