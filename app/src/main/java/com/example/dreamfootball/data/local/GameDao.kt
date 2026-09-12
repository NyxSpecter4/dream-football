package com.example.dreamfootball.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface GameDao {
    @Query("SELECT * FROM game_save WHERE id = :id LIMIT 1")
    fun getSave(id: String = "current_save"): Flow<GameSaveEntity?>

    @Query("SELECT * FROM game_save WHERE id = :id LIMIT 1")
    suspend fun getSaveSync(id: String = "current_save"): GameSaveEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSave(entity: GameSaveEntity)

    @Query("DELETE FROM game_save WHERE id = :id")
    suspend fun deleteSave(id: String = "current_save")

    @Query("SELECT * FROM career_stats WHERE id = :id LIMIT 1")
    fun getCareer(id: String = "career_stats"): Flow<CareerEntity?>

    @Query("SELECT * FROM career_stats WHERE id = :id LIMIT 1")
    suspend fun getCareerSync(id: String = "career_stats"): CareerEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertCareer(entity: CareerEntity)
}
