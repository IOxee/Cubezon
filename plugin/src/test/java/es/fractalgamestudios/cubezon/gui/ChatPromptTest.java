package es.fractalgamestudios.cubezon.gui;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ChatPromptTest {

    @Test
    void acceptsNumbersWithinRange() {
        assertEquals(1, ChatPrompt.parse("1", 34));
        assertEquals(34, ChatPrompt.parse(" 34 ", 34));
    }

    @Test
    void parsesPricesWithDotOrComma() {
        assertEquals(new java.math.BigDecimal("12.50"), ChatPrompt.parsePrice("12,5"));
        assertEquals(new java.math.BigDecimal("400.00"), ChatPrompt.parsePrice(" 400 "));
        assertEquals(new java.math.BigDecimal("0.01"), ChatPrompt.parsePrice("0.01"));
    }

    @Test
    void rejectsInvalidPrices() {
        assertEquals(null, ChatPrompt.parsePrice("0"));
        assertEquals(null, ChatPrompt.parsePrice("-5"));
        assertEquals(null, ChatPrompt.parsePrice("1.234"));
        assertEquals(null, ChatPrompt.parsePrice("diez"));
        assertEquals(null, ChatPrompt.parsePrice("1e5"));
        assertEquals(null, ChatPrompt.parsePrice("9999999999999"));
    }

    @Test
    void rejectsOutOfRangeOrText() {
        assertEquals(-1, ChatPrompt.parse("0", 34));
        assertEquals(-1, ChatPrompt.parse("35", 34));
        assertEquals(-1, ChatPrompt.parse("-3", 34));
        assertEquals(-1, ChatPrompt.parse("diez", 34));
        assertEquals(-1, ChatPrompt.parse("", 34));
        assertEquals(-1, ChatPrompt.parse("99999999999", 34));
    }
}
