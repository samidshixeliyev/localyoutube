package az.dev.localtube.repository;

import az.dev.localtube.entity.Role;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * Role repository - MSSQL storage
 */
@Repository
public interface RoleRepository extends JpaRepository<Role, Long> {
    
    /**
     * Find role by name
     */
    Optional<Role> findByName(String name);
    
    /**
     * Find role with permissions eagerly loaded
     */
    @Query("SELECT r FROM Role r LEFT JOIN FETCH r.permissions WHERE r.name = :name")
    Optional<Role> findByNameWithPermissions(String name);
    
    /**
     * Check if role exists by name
     */
    boolean existsByName(String name);
}