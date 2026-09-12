package com.example.dreamfootball.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "game_save")
data class GameSaveEntity(
    @PrimaryKey val id: String = "current_save",
    val serializedState: String,
    val timestamp: Long = System.currentTimeMillis()
)

@Entity(tableName = "career_stats")
data class CareerEntity(
    @PrimaryKey val id: String = "career_stats",
    val seasons: Int = 0,
    val titles: Int = 0,
    val bestFinish: Int? = null
)
