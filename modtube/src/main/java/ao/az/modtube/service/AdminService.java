package ao.az.modtube.service;

import ao.az.modtube.dto.request.CreateRoleRequest;
import ao.az.modtube.dto.request.CreateUserRequest;
import ao.az.modtube.dto.request.UpdateRoleRequest;
import ao.az.modtube.dto.request.UpdateUserRequest;
import ao.az.modtube.dto.response.PermissionResponse;
import ao.az.modtube.dto.response.RoleResponse;
import ao.az.modtube.dto.response.UserResponse;
import ao.az.modtube.entity.Permission;
import ao.az.modtube.entity.Role;
import ao.az.modtube.entity.User;
import ao.az.modtube.exception.BadRequestException;
import ao.az.modtube.exception.ResourceNotFoundException;
import ao.az.modtube.repository.PermissionRepository;
import ao.az.modtube.repository.RoleRepository;
import ao.az.modtube.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class AdminService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PermissionRepository permissionRepository;
    private final PasswordEncoder passwordEncoder;

    // ═══════════════════════════════════════════════════════════════
    // USER CRUD
    // ═══════════════════════════════════════════════════════════════

    public List<UserResponse> getAllUsers() {
        return userRepository.findAll().stream()
                .map(this::toUserResponse)
                .collect(Collectors.toList());
    }

    public UserResponse getUserById(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + id));
        return toUserResponse(user);
    }

    @Transactional
    public UserResponse createUser(CreateUserRequest request) {
        // Check if email already exists
        if (userRepository.findUserByEmail(request.getEmail()).isPresent()) {
            throw new BadRequestException("Email already in use: " + request.getEmail());
        }

        Role role = roleRepository.findById(request.getRoleId())
                .orElseThrow(() -> new BadRequestException("Role not found with id: " + request.getRoleId()));

        User user = new User();
        user.setName(request.getName());
        user.setSurname(request.getSurname());
        user.setEmail(request.getEmail());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setRole(role);
        user.setCreatedAt(LocalDateTime.now());
        user.setUpdatedAt(LocalDateTime.now());

        user = userRepository.save(user);
        log.info("Created user: {} with role: {}", user.getEmail(), role.getName());

        return toUserResponse(user);
    }

    @Transactional
    public UserResponse updateUser(Long id, UpdateUserRequest request) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + id));

        if (request.getName() != null && !request.getName().isBlank()) {
            user.setName(request.getName());
        }
        if (request.getSurname() != null && !request.getSurname().isBlank()) {
            user.setSurname(request.getSurname());
        }
        if (request.getEmail() != null && !request.getEmail().isBlank()) {
            // Check if new email is taken by another user
            userRepository.findUserByEmail(request.getEmail()).ifPresent(existing -> {
                if (!existing.getId().equals(id)) {
                    throw new BadRequestException("Email already in use: " + request.getEmail());
                }
            });
            user.setEmail(request.getEmail());
        }
        if (request.getRoleId() != null) {
            Role role = roleRepository.findById(request.getRoleId())
                    .orElseThrow(() -> new BadRequestException("Role not found with id: " + request.getRoleId()));
            user.setRole(role);
        }

        user.setUpdatedAt(LocalDateTime.now());
        user = userRepository.save(user);
        log.info("Updated user: {}", user.getEmail());

        return toUserResponse(user);
    }

    @Transactional
    public void deleteUser(Long id, Long currentUserId) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + id));

        // Prevent deleting self
        if (user.getId().equals(currentUserId)) {
            throw new BadRequestException("Cannot delete your own account");
        }

        // Prevent deleting the last super-admin
        boolean isSuperAdmin = user.getRole().getPermissions().stream()
                .anyMatch(p -> "super-admin".equals(p.getName()));
        if (isSuperAdmin) {
            long superAdminCount = countSuperAdmins();
            if (superAdminCount <= 1) {
                throw new BadRequestException("Cannot delete the last super-admin");
            }
        }

        userRepository.delete(user);
        log.info("Deleted user: {} (id: {})", user.getEmail(), id);
    }

    @Transactional
    public void resetUserPassword(Long id, String newPassword) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + id));

        user.setPassword(passwordEncoder.encode(newPassword));
        user.setUpdatedAt(LocalDateTime.now());
        userRepository.save(user);

        log.info("Password reset for user: {} (id: {})", user.getEmail(), id);
    }

    // ═══════════════════════════════════════════════════════════════
    // PERMISSION QUERIES
    // ═══════════════════════════════════════════════════════════════

    public List<PermissionResponse> getAllPermissions() {
        return permissionRepository.findAll().stream()
                .map(this::toPermissionResponse)
                .collect(Collectors.toList());
    }

    // ═══════════════════════════════════════════════════════════════
    // ROLE CRUD
    // ═══════════════════════════════════════════════════════════════

    public List<RoleResponse> getAllRoles() {
        return roleRepository.findAll().stream()
                .map(this::toRoleResponse)
                .collect(Collectors.toList());
    }

    public RoleResponse getRoleById(Long id) {
        Role role = roleRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Role not found with id: " + id));
        return toRoleResponse(role);
    }

    @Transactional
    public RoleResponse createRole(CreateRoleRequest request) {
        if (roleRepository.findByName(request.getName()).isPresent()) {
            throw new BadRequestException("Role name already exists: " + request.getName());
        }

        Role role = new Role();
        role.setName(request.getName().trim());
        role.setDescription(request.getDescription());
        role.setCreatedAt(LocalDateTime.now());
        role.setPermissions(resolvePermissions(request.getPermissionIds()));

        role = roleRepository.save(role);
        log.info("Created role: {}", role.getName());
        return toRoleResponse(role);
    }

    @Transactional
    public RoleResponse updateRole(Long id, UpdateRoleRequest request) {
        Role role = roleRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Role not found with id: " + id));

        // Guard: super-admin role name cannot be changed
        if ("super-admin".equals(role.getName()) && request.getName() != null
                && !request.getName().equals(role.getName())) {
            throw new BadRequestException("Cannot rename the super-admin role");
        }

        if (request.getName() != null && !request.getName().isBlank()) {
            // Check uniqueness (another role with same name)
            roleRepository.findByName(request.getName()).ifPresent(existing -> {
                if (!existing.getId().equals(id)) {
                    throw new BadRequestException("Role name already in use: " + request.getName());
                }
            });
            role.setName(request.getName().trim());
        }
        if (request.getDescription() != null) {
            role.setDescription(request.getDescription());
        }
        if (request.getPermissionIds() != null) {
            // Guard: super-admin permission cannot be removed from super-admin role
            if ("super-admin".equals(role.getName())) {
                boolean keepsSuperAdmin = request.getPermissionIds().stream().anyMatch(pid ->
                        permissionRepository.findById(pid)
                                .map(p -> "super-admin".equals(p.getName()))
                                .orElse(false));
                if (!keepsSuperAdmin) {
                    throw new BadRequestException("Cannot remove the super-admin permission from the super-admin role");
                }
            }
            role.setPermissions(resolvePermissions(request.getPermissionIds()));
        }

        role = roleRepository.save(role);
        log.info("Updated role: {}", role.getName());
        return toRoleResponse(role);
    }

    @Transactional
    public void deleteRole(Long id) {
        Role role = roleRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Role not found with id: " + id));

        // Guard: cannot delete a built-in protected role
        if ("super-admin".equals(role.getName())) {
            throw new BadRequestException("Cannot delete the super-admin role");
        }

        // Guard: cannot delete a role that is currently assigned to users
        long usersWithRole = userRepository.findAll().stream()
                .filter(u -> u.getRole() != null && u.getRole().getId().equals(id))
                .count();
        if (usersWithRole > 0) {
            throw new BadRequestException(
                    "Cannot delete role '" + role.getName() + "' — it is assigned to " + usersWithRole + " user(s)");
        }

        roleRepository.delete(role);
        log.info("Deleted role: {}", role.getName());
    }

    // ═══════════════════════════════════════════════════════════════
    // HELPERS
    // ═══════════════════════════════════════════════════════════════

    private long countSuperAdmins() {
        return userRepository.findAll().stream()
                .filter(u -> u.getRole() != null && u.getRole().getPermissions().stream()
                        .anyMatch(p -> "super-admin".equals(p.getName())))
                .count();
    }

    private UserResponse toUserResponse(User user) {
        List<String> permissions = user.getRole() != null
                ? user.getRole().getPermissions().stream()
                .map(Permission::getName)
                .collect(Collectors.toList())
                : List.of();

        return UserResponse.builder()
                .id(user.getId())
                .name(user.getName())
                .surname(user.getSurname())
                .fullName(user.getFullName())
                .email(user.getEmail())
                .roleId(user.getRole() != null ? user.getRole().getId() : null)
                .roleName(user.getRole() != null ? user.getRole().getName() : null)
                .permissions(permissions)
                .createdAt(user.getCreatedAt())
                .updatedAt(user.getUpdatedAt())
                .build();
    }

    private RoleResponse toRoleResponse(Role role) {
        return RoleResponse.builder()
                .id(role.getId())
                .name(role.getName())
                .description(role.getDescription())
                .permissions(role.getPermissions().stream()
                        .map(Permission::getName)
                        .collect(Collectors.toList()))
                .createdAt(role.getCreatedAt())
                .build();
    }

    private Set<Permission> resolvePermissions(List<Long> ids) {
        if (ids == null || ids.isEmpty()) return new HashSet<>();
        return ids.stream()
                .map(pid -> permissionRepository.findById(pid)
                        .orElseThrow(() -> new BadRequestException("Permission not found: " + pid)))
                .collect(java.util.stream.Collectors.toSet());
    }

    private PermissionResponse toPermissionResponse(Permission p) {
        return PermissionResponse.builder()
                .id(p.getId())
                .name(p.getName())
                .description(p.getDescription())
                .permissionType(p.getPermissionType())
                .build();
    }
}