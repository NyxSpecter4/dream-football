package com.example.dreamfootball

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.dreamfootball.data.model.GameScreen
import com.example.dreamfootball.data.model.Phase
import com.example.dreamfootball.ui.screens.AuctionScreen
import com.example.dreamfootball.ui.screens.HomeScreen
import com.example.dreamfootball.ui.screens.MatchupScreen
import com.example.dreamfootball.ui.screens.OffseasonScreen
import com.example.dreamfootball.ui.screens.RosterScreen
import com.example.dreamfootball.ui.screens.SetupScreen
import com.example.dreamfootball.ui.screens.StandingsScreen
import com.example.dreamfootball.ui.screens.TitleScreen
import com.example.dreamfootball.ui.theme.DarkBg
import com.example.dreamfootball.ui.theme.DreamFootballTheme
import com.example.dreamfootball.ui.viewmodel.GameViewModel

class MainActivity : ComponentActivity() {

    private val viewModel: GameViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        setContent {
            DreamFootballTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = DarkBg
                ) {
                    val state by viewModel.state.collectAsStateWithLifecycle()

                    // Back button behavior
                    BackHandler(enabled = state.screen != GameScreen.TITLE) {
                        when (state.screen) {
                            GameScreen.SETUP -> viewModel.setScreen(GameScreen.TITLE)
                            GameScreen.DRAFT -> viewModel.setScreen(GameScreen.TITLE)
                            GameScreen.ROSTER, GameScreen.STANDINGS, GameScreen.MATCHUP -> viewModel.setScreen(GameScreen.HOME)
                            GameScreen.OFFSEASON -> viewModel.setScreen(GameScreen.HOME)
                            GameScreen.HOME -> viewModel.setScreen(GameScreen.TITLE)
                            GameScreen.TITLE -> {}
                        }
                    }

                    when (state.screen) {
                        GameScreen.TITLE -> {
                            TitleScreen(
                                state = state,
                                onStartNew = { viewModel.setScreen(GameScreen.SETUP) },
                                onContinue = {
                                    val destination = if (state.phase == Phase.DRAFT) GameScreen.DRAFT else GameScreen.HOME
                                    viewModel.setScreen(destination)
                                }
                            )
                        }
                        GameScreen.SETUP -> {
                            SetupScreen(
                                onBack = { viewModel.setScreen(GameScreen.TITLE) },
                                onSubmit = { name, tag, jersey, city, stadium ->
                                    viewModel.startNewSeason(name, tag, jersey, city, stadium)
                                }
                            )
                        }
                        GameScreen.DRAFT -> {
                            AuctionScreen(
                                state = state,
                                onNominate = { playerId, openingBid ->
                                    viewModel.nominate(playerId, openingBid)
                                },
                                onBid = { amount ->
                                    viewModel.humanBid(amount)
                                },
                                onPass = {
                                    viewModel.humanPass()
                                },
                                onCpuStep = {
                                    viewModel.cpuStep()
                                },
                                onAutoFill = {
                                    viewModel.autoFillRemainingDraft()
                                }
                            )
                        }
                        GameScreen.HOME -> {
                            HomeScreen(
                                state = state,
                                onPlayWeek = { viewModel.playWeek() },
                                onNavigateRoster = { viewModel.setScreen(GameScreen.ROSTER) },
                                onNavigateStandings = { viewModel.setScreen(GameScreen.STANDINGS) },
                                onNavigateMatchup = { viewModel.setScreen(GameScreen.MATCHUP) },
                                onPlaceSideBet = { stake -> viewModel.placeSideBet(stake) }
                            )
                        }
                        GameScreen.ROSTER -> {
                            RosterScreen(
                                state = state,
                                onBack = { viewModel.setScreen(GameScreen.HOME) },
                                onSwap = { slot, benchPlayerId ->
                                    viewModel.swapLineup(slot, benchPlayerId)
                                },
                                onWaiverClaim = { dropId, addId ->
                                    viewModel.claimWaiver(dropId, addId)
                                }
                            )
                        }
                        GameScreen.MATCHUP -> {
                            MatchupScreen(
                                state = state,
                                onNextWeek = { viewModel.nextWeek() }
                            )
                        }
                        GameScreen.STANDINGS -> {
                            StandingsScreen(
                                state = state,
                                onBack = { viewModel.setScreen(GameScreen.HOME) }
                            )
                        }
                        GameScreen.OFFSEASON -> {
                            OffseasonScreen(
                                state = state,
                                onCutPlayer = { playerId ->
                                    viewModel.cutPlayerOffseason(playerId)
                                },
                                onStartNextSeason = {
                                    viewModel.startNextDynastySeason()
                                }
                            )
                        }
                    }
                }
            }
        }
    }
}
