package es.fractalgamestudios.cubezon.roleplay;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ExpressRuleTest {

    @Test
    void locker_orders_always_need_a_courier() {
        assertTrue(ExpressRule.needsCourier(false, false));
        assertTrue(ExpressRule.needsCourier(false, true));
    }

    @Test
    void express_orders_arrive_on_their_own_unless_hand_delivery_is_on() {
        assertFalse(ExpressRule.needsCourier(true, false));
        assertTrue(ExpressRule.needsCourier(true, true));
    }
}
