package az.dev.localtube.service;

import az.dev.localtube.config.security.LocalTubeUserDetails;
import az.dev.localtube.entity.User;
import az.dev.localtube.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
@RequiredArgsConstructor
public class UserService implements UserDetailsService {

    private final UserRepository userRepository;

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        User user = userRepository.findUserByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + email));

        // FIXED: Return LocalTubeUserDetails instead of Spring Security User
        return new LocalTubeUserDetails(user);
    }

    public Optional<User> findByEmail(String email) {
        return userRepository.findUserByEmail(email);
    }

    public Optional<User> findById(Long id) {
        return userRepository.findById(id);
    }
}