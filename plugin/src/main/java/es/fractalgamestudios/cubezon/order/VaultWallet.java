package es.fractalgamestudios.cubezon.order;

import net.milkbowl.vault.economy.Economy;
import org.bukkit.Server;

import java.math.BigDecimal;
import java.util.UUID;

/** OrderPayment.Wallet over Vault. Works for offline players too. Main thread only. */
public final class VaultWallet implements OrderPayment.Wallet {

    private final Economy economy;
    private final Server server;

    public VaultWallet(Economy economy, Server server) {
        this.economy = economy;
        this.server = server;
    }

    @Override
    public boolean has(UUID player, BigDecimal amount) {
        return economy.has(server.getOfflinePlayer(player), amount.doubleValue());
    }

    @Override
    public boolean withdraw(UUID player, BigDecimal amount) {
        return economy.withdrawPlayer(server.getOfflinePlayer(player), amount.doubleValue()).transactionSuccess();
    }

    @Override
    public boolean deposit(UUID player, BigDecimal amount) {
        return economy.depositPlayer(server.getOfflinePlayer(player), amount.doubleValue()).transactionSuccess();
    }
}
