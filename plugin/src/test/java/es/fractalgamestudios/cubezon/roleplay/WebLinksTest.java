package es.fractalgamestudios.cubezon.roleplay;

import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;

class WebLinksTest {

    @Test
    void buildsTheStorefrontAndPanelOfAShop() {
        WebLinks links = WebLinks.of("https://cubezon.example.com/").orElseThrow();

        assertEquals("https://cubezon.example.com/t/bear-co", links.storefront("bear-co"));
        assertEquals("https://cubezon.example.com/panel/bear-co", links.panel("bear-co"));
    }

    @Test
    void escapesAnythingOddInTheSlug() {
        WebLinks links = WebLinks.of("http://localhost:3000").orElseThrow();

        assertEquals("http://localhost:3000/t/a%20b%2Fc", links.storefront("a b/c"));
    }

    @Test
    void withoutAValidWebAddressThereAreNoLinks() {
        assertEquals(Optional.empty(), WebLinks.of(""));
        assertEquals(Optional.empty(), WebLinks.of(null));
        assertEquals(Optional.empty(), WebLinks.of("javascript:alert(1)"));
        assertEquals(Optional.empty(), WebLinks.of("cubezon.example.com"));
    }
}
