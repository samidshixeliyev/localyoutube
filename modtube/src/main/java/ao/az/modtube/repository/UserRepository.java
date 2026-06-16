package ao.az.modtube.repository;

import ao.az.modtube.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findUserByEmail(String email);

    Optional<User> findByIdpSubject(String idpSubject);

    @Query(nativeQuery = true, value = """
        SELECT DISTINCT u.* FROM users u
        LEFT JOIN roles r ON u.role_id = r.id
        LEFT JOIN role_permission rp ON r.id = rp.role_id
        LEFT JOIN permissions p ON rp.permission_id = p.id
        WHERE (
            :search = '' OR
            LOWER(u.name) LIKE LOWER(CONCAT('%', :search, '%')) OR
            LOWER(COALESCE(u.surname, '')) LIKE LOWER(CONCAT('%', :search, '%')) OR
            LOWER(u.email) LIKE LOWER(CONCAT('%', :search, '%')) OR
            LOWER(COALESCE(r.name, '')) LIKE LOWER(CONCAT('%', :search, '%'))
        )
        AND (:roleId = 0 OR u.role_id = :roleId)
        AND (:permission = '' OR p.name = :permission)
        ORDER BY u.created_at DESC NULLS LAST
        LIMIT :size OFFSET :offset
        """)
    List<User> searchUsersPaged(
        @Param("search") String search,
        @Param("roleId") long roleId,
        @Param("permission") String permission,
        @Param("offset") int offset,
        @Param("size") int size
    );

    @Query(nativeQuery = true, value = """
        SELECT COUNT(DISTINCT u.id) FROM users u
        LEFT JOIN roles r ON u.role_id = r.id
        LEFT JOIN role_permission rp ON r.id = rp.role_id
        LEFT JOIN permissions p ON rp.permission_id = p.id
        WHERE (
            :search = '' OR
            LOWER(u.name) LIKE LOWER(CONCAT('%', :search, '%')) OR
            LOWER(COALESCE(u.surname, '')) LIKE LOWER(CONCAT('%', :search, '%')) OR
            LOWER(u.email) LIKE LOWER(CONCAT('%', :search, '%')) OR
            LOWER(COALESCE(r.name, '')) LIKE LOWER(CONCAT('%', :search, '%'))
        )
        AND (:roleId = 0 OR u.role_id = :roleId)
        AND (:permission = '' OR p.name = :permission)
        """)
    long countSearchUsers(
        @Param("search") String search,
        @Param("roleId") long roleId,
        @Param("permission") String permission
    );
}