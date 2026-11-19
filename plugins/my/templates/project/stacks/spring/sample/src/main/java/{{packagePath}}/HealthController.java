package {{package}};

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HealthController {

  public record Health(String status) {}

  // REQ-00: 서버가 살아 있는지 알려 준다(기준 구현 예시)
  @GetMapping("/health")
  public Health getHealth() {
    return new Health("ok");
  }
}
