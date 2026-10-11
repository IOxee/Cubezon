package es.fractalgamestudios.cubezon.order;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class OrderDelayTest {

    @Test
    void minutesBecomeSeconds() {
        OrderDelay delay = OrderDelay.ofMinutes(5, 10);
        assertEquals(300, delay.minSeconds());
        assertEquals(600, delay.maxSeconds());
        assertEquals(300, delay.rangeSeconds());
    }

    @Test
    void aMaximumBelowTheMinimumCollapsesToTheMinimum() {
        OrderDelay delay = OrderDelay.ofMinutes(10, 5);
        assertEquals(600, delay.minSeconds());
        assertEquals(600, delay.maxSeconds());
        assertEquals(0, delay.rangeSeconds());
    }

    @Test
    void negativeValuesAreZero() {
        OrderDelay delay = OrderDelay.ofMinutes(-3, -1);
        assertEquals(0, delay.minSeconds());
        assertEquals(0, delay.maxSeconds());
        assertTrue(delay.isNone());
    }

    @Test
    void theDelayIsCappedAtOneDay() {
        OrderDelay delay = OrderDelay.ofMinutes(0, 99_999);
        assertEquals(0, delay.minSeconds());
        assertEquals(86_400, delay.maxSeconds());
    }

    @Test
    void fractionalMinutesAreKept() {
        assertEquals(90, OrderDelay.ofMinutes(1.5, 1.5).minSeconds());
    }

    @Test
    void noneHasNoDelay() {
        assertTrue(OrderDelay.NONE.isNone());
    }
}
