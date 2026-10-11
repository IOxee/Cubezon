plugins {
    java
    id("com.gradleup.shadow") version "9.6.1"
}

val minecraftVersion: String by project

repositories {
    mavenCentral()
    maven("https://repo.papermc.io/repository/maven-public/")
    maven("https://jitpack.io") {
        content { includeGroup("com.github.MilkBowl") }
    }
}

dependencies {
    compileOnly("io.papermc.paper:paper-api:$minecraftVersion-R0.1-SNAPSHOT")
    compileOnly("com.github.MilkBowl:VaultAPI:1.7.1") {
        exclude(group = "org.bukkit", module = "bukkit")
    }

    implementation("com.zaxxer:HikariCP:7.1.0")
    implementation("org.postgresql:postgresql:42.7.14")

    // Bukkit's YamlConfiguration in tests (config migration); provided by the server at runtime.
    testImplementation("io.papermc.paper:paper-api:$minecraftVersion-R0.1-SNAPSHOT")
    testImplementation(platform("org.junit:junit-bom:6.1.3"))
    testImplementation("org.junit.jupiter:junit-jupiter")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

java {
    toolchain.languageVersion = JavaLanguageVersion.of(21)
}

tasks {
    withType<JavaCompile>().configureEach {
        options.encoding = "UTF-8"
        options.release = 21
    }

    processResources {
        filteringCharset = "UTF-8"
        val props = mapOf("version" to project.version)
        inputs.properties(props)
        filesMatching("plugin.yml") { expand(props) }
    }

    jar {
        archiveClassifier = "plain"
    }

    shadowJar {
        archiveClassifier = ""
        val base = "es.fractalgamestudios.cubezon.libs"
        relocate("com.zaxxer.hikari", "$base.hikari")
        relocate("org.postgresql", "$base.postgresql")
    }

    build {
        dependsOn(shadowJar)
    }

    test {
        useJUnitPlatform()
    }

    // Copies the plugin jar into the local test server (../../server/plugins).
    register<Copy>("deployToServer") {
        group = "cubezon"
        description = "Builds the plugin and copies it into the local test server."
        val pluginsDir = rootDir.resolve("../../server/plugins")
        from(shadowJar)
        into(pluginsDir)
        rename { "Cubezon-${project.version}.jar" }
        doFirst {
            // Paper must load a single Cubezon: drop the previous jar (Cubezon.jar or Cubezon-<version>.jar).
            pluginsDir.listFiles { file -> file.isFile && file.name.matches(Regex("Cubezon(-[0-9.]+)?\\.jar")) }
                ?.forEach { old -> check(old.delete()) { "Cannot delete ${old.name}: stop the server first." } }
        }
    }
}
