package az.dev.modtube.config;

import az.dev.modtube.entity.Permission;
import az.dev.modtube.entity.Role;
import az.dev.modtube.entity.User;
import az.dev.modtube.repository.PermissionRepository;
import az.dev.modtube.repository.RoleRepository;
import az.dev.modtube.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Set;

@Slf4j
@Component
@RequiredArgsConstructor
public class DataSeeder implements ApplicationRunner {

    private final PermissionRepository permissionRepository;
    private final RoleRepository roleRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${localtube.admin.email:admin@localtube.local}")
    private String adminEmail;

    @Value("${localtube.admin.password:changeme}")
    private String adminPassword;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        seedPermissions();
        seedRoles();
        seedSuperAdmin();
    }

    private void seedPermissions() {
        ensurePermission("super-admin",   "Full system access",            "SYSTEM");
        ensurePermission("admin-modtube", "Manage videos and content",     "CONTENT");
        ensurePermission("view-private",  "View private/restricted videos","CONTENT");
    }

    private void seedRoles() {
        if (roleRepository.findByName("SUPER_ADMIN").isEmpty()) {
            Permission superAdminPerm = permissionRepository.findByName("super-admin").orElseThrow();
            Permission adminModPerm  = permissionRepository.findByName("admin-modtube").orElseThrow();
            Permission viewPrivPerm  = permissionRepository.findByName("view-private").orElseThrow();

            Role superAdmin = new Role();
            superAdmin.setName("SUPER_ADMIN");
            superAdmin.setDescription("Super administrator with full access");
            superAdmin.setPermissions(Set.of(superAdminPerm, adminModPerm, viewPrivPerm));
            superAdmin.setCreatedAt(LocalDateTime.now());
            roleRepository.save(superAdmin);
            log.info("Created SUPER_ADMIN role");
        }

        if (roleRepository.findByName("ADMIN").isEmpty()) {
            Permission adminModPerm = permissionRepository.findByName("admin-modtube").orElseThrow();
            Permission viewPrivPerm = permissionRepository.findByName("view-private").orElseThrow();

            Role admin = new Role();
            admin.setName("ADMIN");
            admin.setDescription("Administrator");
            admin.setPermissions(Set.of(adminModPerm, viewPrivPerm));
            admin.setCreatedAt(LocalDateTime.now());
            roleRepository.save(admin);
            log.info("Created ADMIN role");
        }

        if (roleRepository.findByName("USER").isEmpty()) {
            Role user = new Role();
            user.setName("USER");
            user.setDescription("Regular authenticated user");
            user.setPermissions(Set.of());
            user.setCreatedAt(LocalDateTime.now());
            roleRepository.save(user);
            log.info("Created USER role");
        }
    }

    private void seedSuperAdmin() {
        if (userRepository.findUserByEmail(adminEmail).isPresent()) {
            return;
        }
        Role superAdminRole = roleRepository.findByName("SUPER_ADMIN").orElseThrow();

        User admin = new User();
        admin.setName("Admin");
        admin.setSurname("ModTube");
        admin.setEmail(adminEmail);
        admin.setPassword(passwordEncoder.encode(adminPassword));
        admin.setRole(superAdminRole);
        admin.setCreatedAt(LocalDateTime.now());
        userRepository.save(admin);
        log.info("Created super-admin user: {}", adminEmail);
    }

    private void ensurePermission(String name, String description, String type) {
        if (permissionRepository.findByName(name).isEmpty()) {
            Permission p = new Permission();
            p.setName(name);
            p.setDescription(description);
            p.setPermissionType(type);
            p.setCreatedAt(LocalDateTime.now());
            permissionRepository.save(p);
            log.info("Created permission: {}", name);
        }
    }
}
