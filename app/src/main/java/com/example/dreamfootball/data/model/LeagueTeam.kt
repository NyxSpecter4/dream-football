package com.example.dreamfootball.data.model

import kotlinx.serialization.Serializable

@Serializable
enum class JerseyTheme(val label: String, val primaryHex: Long, val secondaryHex: Long) {
    MIDNIGHT("Midnight", 0xFF0D1B2A, 0xFF415A77),
    BONE("Bone", 0xFFE0E1DD, 0xFF778DA9),
    CRIMSON("Crimson", 0xFF9E2A2B, 0xFF540B0E),
    ROYAL("Royal", 0xFF1D3557, 0xFF457B9D),
    EMERALD("Emerald", 0xFF2D6A4F, 0xFF52B788),
    GOLD("Gold", 0xFFD4A373, 0xFFFAEDCD),
    SUNSET("Sunset", 0xFFE76F51, 0xFFF4A261),
    STEEL("Steel", 0xFF3D5A80, 0xFF98C1D9),
    PINE("Pine", 0xFF1B4332, 0xFF40916C),
    CREAM("Cream", 0xFFEDE0D4, 0xFFDDBEA9)
}

@Serializable
data class LeagueTeam(
    val id: String,
    val name: String,
    val short: String,
    val jersey: JerseyTheme,
    val city: String,
    val stadium: String,
    val human: Boolean = false,
    val nfl: String = "NFL"
)

@Serializable
data class Roster(
    val lineup: Map<Slot, String?> = emptyMap(),
    val bench: List<String> = emptyList()
) {
    fun allPlayerIds(): List<String> {
        val starters = lineup.values.filterNotNull()
        return starters + bench
    }

    fun spotsLeft(): Int {
        val count = allPlayerIds().size
        return (10 - count).coerceAtLeast(0)
    }
}
