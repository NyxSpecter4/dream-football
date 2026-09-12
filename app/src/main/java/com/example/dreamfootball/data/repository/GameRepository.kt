package com.example.dreamfootball.data.repository

import com.example.dreamfootball.data.local.CareerEntity
import com.example.dreamfootball.data.local.GameDao
import com.example.dreamfootball.data.local.GameSaveEntity
import com.example.dreamfootball.data.model.CareerStats
import com.example.dreamfootball.data.model.GameState
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

class GameRepository(private val gameDao: GameDao) {

    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
    }

    suspend fun loadState(): GameState? = withContext(Dispatchers.IO) {
        val entity = gameDao.getSaveSync() ?: return@withContext null
        try {
            json.decodeFromString<GameState>(entity.serializedState)
        } catch (e: Exception) {
            null
        }
    }

    suspend fun saveState(state: GameState) = withContext(Dispatchers.IO) {
        try {
            val serialized = json.encodeToString(state)
            gameDao.insertSave(GameSaveEntity(serializedState = serialized))
        } catch (e: Exception) {
            // Ignore failure on save
        }
    }

    suspend fun clearSave() = withContext(Dispatchers.IO) {
        gameDao.deleteSave()
    }

    suspend fun loadCareer(): CareerStats = withContext(Dispatchers.IO) {
        val entity = gameDao.getCareerSync() ?: return@withContext CareerStats()
        CareerStats(
            seasons = entity.seasons,
            titles = entity.titles,
            bestFinish = entity.bestFinish
        )
    }

    suspend fun saveCareer(career: CareerStats) = withContext(Dispatchers.IO) {
        gameDao.insertCareer(
            CareerEntity(
                seasons = career.seasons,
                titles = career.titles,
                bestFinish = career.bestFinish
            )
        )
    }
}
