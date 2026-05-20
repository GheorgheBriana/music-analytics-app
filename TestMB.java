import org.springframework.web.util.UriComponentsBuilder;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;

public class TestMB {
    public static void main(String[] args) {
        String url = UriComponentsBuilder.fromUriString("https://musicbrainz.org/ws/2/artist")
                .queryParam("query", "artist:\"Taylor Swift\"")
                .queryParam("fmt", "json")
                .toUriString();
        System.out.println("URL: " + url);
        RestTemplate restTemplate = new RestTemplate();
        HttpHeaders headers = new HttpHeaders();
        headers.set("User-Agent", "MusicAnalyticsApp/1.0 ( dw@example.com )");
        HttpEntity<String> entity = new HttpEntity<>(headers);
        String response = restTemplate.exchange(url, HttpMethod.GET, entity, String.class).getBody();
        System.out.println("Response length: " + (response != null ? response.length() : 0));
        System.out.println("Snippet: " + response.substring(0, Math.min(200, response.length())));
    }
}
