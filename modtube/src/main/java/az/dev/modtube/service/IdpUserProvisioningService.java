package az.dev.modtube.service;

import az.dev.modtube.entity.Role;
import az.dev.modtube.entity.User;
import az.dev.modtube.repository.RoleRepository;
import az.dev.modtube.repository.UserRepository;
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
     * Returns the existing DB user for the given email, or creates a new one
     * with the default USER role. Subsequent logins update the display name
     * if it changed in the IDP.
     */
    @Transactional
    public User getOrCreate(String email, String displayName) {
        return userRepository.findUserByEmail(email)
                .map(existing -> {
                    // Sync display name in case it changed on the IDP side
                    String[] parts = splitName(displayName != null ? displayName : email);
                    boolean changed = false;
                    if (!parts[0].equals(existing.getName())) {
                        existing.setName(parts[0]);
                        changed = true;
                    }
                    String newSurname = parts.length > 1 ? parts[1] : null;
                    if (!java.util.Objects.equals(newSurname, existing.getSurname())) {
                        existing.setSurname(newSurname);
                        changed = true;
                    }
                    if (changed) {
                        existing.setUpdatedAt(LocalDateTime.now());
                        userRepository.save(existing);
                    }
                    return existing;
                })
                .orElseGet(() -> {
                    log.info("Auto-provisioning IDP user: {}", email);

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
                    // Non-usable placeholder — IDP users never authenticate with password
                    user.setPassword("{idp}" + UUID.randomUUID());
                    user.setRole(userRole);
                    user.setCreatedAt(LocalDateTime.now());
                    user.setUpdatedAt(LocalDateTime.now());

                    User saved = userRepository.save(user);
                    log.info("IDP user provisioned: id={} email={}", saved.getId(), email);
                    return saved;
                });
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
