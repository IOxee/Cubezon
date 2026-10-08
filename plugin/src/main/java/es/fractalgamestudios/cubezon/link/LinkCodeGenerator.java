package es.fractalgamestudios.cubezon.link;

import java.security.SecureRandom;
import java.util.random.RandomGenerator;

/** Generates short, human-friendly codes to link a Minecraft account with the web. */
public final class LinkCodeGenerator {

    /** No 0/O, 1/I/L, to avoid typos when copying the code. */
    static final String ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
    static final int LENGTH = 6;

    private final RandomGenerator random;

    public LinkCodeGenerator() {
        this(new SecureRandom());
    }

    LinkCodeGenerator(RandomGenerator random) {
        this.random = random;
    }

    public String next() {
        StringBuilder code = new StringBuilder(LENGTH);
        for (int i = 0; i < LENGTH; i++) {
            code.append(ALPHABET.charAt(random.nextInt(ALPHABET.length())));
        }
        return code.toString();
    }
}
