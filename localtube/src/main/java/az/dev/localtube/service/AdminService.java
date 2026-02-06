package az.dev.localtube.service;

import az.dev.localtube.dto.request.CreateUserRequest;
import az.dev.localtube.dto.request.UpdateUserRequest;
import az.dev.localtube.dto.response.RoleResponse;
import az.dev.localtube.dto.response.UserResponse;
import az.dev.localtube.entity.Permission;
import az.dev.localtube.entity.Role;
import az.dev.localtube.entity.User;
import az.dev.localtube.exception.BadRequestException;
import az.dev.localtube.exception.ResourceNotFoundException;
import az.dev.localtube.repository.RoleRepository;
import az.dev.localtube.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class AdminService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
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
    // ROLE QUERIES
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
}