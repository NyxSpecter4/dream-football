package com.example.dreamfootball.data.model

import kotlinx.serialization.Serializable

@Serializable
enum class Position {
    QB, RB, WR, TE, K, DST
}

@Serializable
enum class Slot {
    QB, RB1, RB2, WR1, WR2, TE, FLEX, K, DST
}

@Serializable
data class Player(
    val id: String,
    val name: String,
    val pos: Position,
    val nfl: String,
    val bye: Int,
    val ovr: Int,
    val boom: Float = 0.5f,
    val durability: Float = 0.9f
)

@Serializable
data class Contract(
    val playerId: String,
    val teamId: String,
    val price: Int
)

@Serializable
data class DreamProj(
    val mid: Float,
    val floor: Float,
    val ceil: Float,
    val vorp: Float
)
