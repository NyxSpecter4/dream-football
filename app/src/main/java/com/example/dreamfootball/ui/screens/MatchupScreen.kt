package com.example.dreamfootball.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.Forward
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.dreamfootball.data.model.GameState
import com.example.dreamfootball.data.model.Phase
import com.example.dreamfootball.data.model.Slot
import com.example.dreamfootball.domain.LeagueEngine
import com.example.dreamfootball.domain.PlayersData
import com.example.dreamfootball.ui.components.JerseyBadge
import com.example.dreamfootball.ui.components.TurfFieldBackground
import com.example.dreamfootball.ui.components.fmtMoney
import com.example.dreamfootball.ui.components.fmtPts
import com.example.dreamfootball.ui.theme.DarkBg
import com.example.dreamfootball.ui.theme.DarkSurface
import com.example.dreamfootball.ui.theme.DarkSurfaceBorder
import com.example.dreamfootball.ui.theme.DarkSurfaceVariant
import com.example.dreamfootball.ui.theme.GoldAccent
import com.example.dreamfootball.ui.theme.GreenPrimary
import com.example.dreamfootball.ui.theme.LossColor
import com.example.dreamfootball.ui.theme.TextMuted
import com.example.dreamfootball.ui.theme.TextPrimary
import com.example.dreamfootball.ui.theme.TextSecondary
import com.example.dreamfootball.ui.theme.WinColor

@Composable
fun MatchupScreen(
    state: GameState,
    onNextWeek: () -> Unit
) {
    val weekResults = state.results[state.week] ?: emptyMap()
    val yourBox = weekResults["you"]
    val opponentId = yourBox?.opponentId
    val opponent = state.teams.find { it.id == opponentId }
    val oppBox = opponentId?.let { weekResults[it] }

    val you = state.teams.find { it.id == "you" } ?: return
    val userWon = yourBox?.won == true

    TurfFieldBackground {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp)
        ) {
            // Header Outcome Banner
            Card(
                colors = CardDefaults.cardColors(
                    containerColor = if (userWon) GreenPrimary.copy(alpha = 0.15f) else LossColor.copy(alpha = 0.15f)
                ),
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .border(
                        width = 1.5.dp,
                        color = if (userWon) GreenPrimary else LossColor,
                        shape = RoundedCornerShape(16.dp)
                    )
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(18.dp)
                ) {
                    Text(
                        text = if (userWon) "VICTORY!" else "DEFEAT",
                        color = if (userWon) GreenPrimary else LossColor,
                        fontSize = 24.sp,
                        fontWeight = FontWeight.Black,
                        fontFamily = FontFamily.SansSerif,
                        letterSpacing = 2.sp
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    Row(
                        horizontalArrangement = Arrangement.SpaceAround,
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        // You
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                JerseyBadge(jersey = you.jersey, sizeDp = 14)
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(you.short, color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                            }
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = fmtPts(yourBox?.points ?: 0f),
                                color = if (userWon) GreenPrimary else TextPrimary,
                                fontSize = 28.sp,
                                fontWeight = FontWeight.Black,
                                fontFamily = FontFamily.Monospace
                            )
                        }

                        Text("—", color = TextMuted, fontSize = 20.sp)

                        // Opponent
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(opponent?.short ?: "OPP", color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                                if (opponent != null) {
                                    Spacer(modifier = Modifier.width(6.dp))
                                    JerseyBadge(jersey = opponent.jersey, sizeDp = 14)
                                }
                            }
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = fmtPts(oppBox?.points ?: 0f),
                                color = if (!userWon) LossColor else TextPrimary,
                                fontSize = 28.sp,
                                fontWeight = FontWeight.Black,
                                fontFamily = FontFamily.Monospace
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            // Side Bet Settlement Status
            val betThisWeek = state.bets.find { it.week == state.week && (it.fromId == "you" || it.toId == "you") }
            if (betThisWeek != null) {
                Surface(
                    color = DarkSurface,
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(1.dp, DarkSurfaceBorder, RoundedCornerShape(10.dp))
                ) {
                    Row(
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(12.dp)
                    ) {
                        val betWon = betThisWeek.winnerId == "you"
                        Text(
                            text = if (betWon) "SIDE BET WON! +${fmtMoney(betThisWeek.stake)}" else "SIDE BET LOST -${fmtMoney(betThisWeek.stake)}",
                            color = if (betWon) GoldAccent else LossColor,
                            fontWeight = FontWeight.Bold,
                            fontSize = 12.sp,
                            fontFamily = FontFamily.Monospace
                        )
                        Text(
                            text = "BANK: ${fmtMoney(state.cash["you"] ?: 0)}",
                            color = TextSecondary,
                            fontWeight = FontWeight.Bold,
                            fontSize = 12.sp,
                            fontFamily = FontFamily.Monospace
                        )
                    }
                }
                Spacer(modifier = Modifier.height(12.dp))
            }

            // Head-to-Head Lineup Box Scores
            Text(
                text = "BOX SCORE BREAKDOWN",
                color = TextSecondary,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace,
                letterSpacing = 1.sp
            )
            Spacer(modifier = Modifier.height(8.dp))

            val yourRoster = state.rosters["you"]
            val oppRoster = opponentId?.let { state.rosters[it] }

            LazyColumn(
                verticalArrangement = Arrangement.spacedBy(6.dp),
                modifier = Modifier.weight(1f)
            ) {
                items(Slot.entries.toTypedArray()) { slot ->
                    val yourPlayerId = yourRoster?.lineup?.get(slot)
                    val yourPlayer = yourPlayerId?.let { PlayersData.getPlayer(it) }
                    val yourPts = yourPlayerId?.let { yourBox?.playerPoints?.get(it) } ?: 0f

                    val oppPlayerId = oppRoster?.lineup?.get(slot)
                    val oppPlayer = oppPlayerId?.let { PlayersData.getPlayer(it) }
                    val oppPts = oppPlayerId?.let { oppBox?.playerPoints?.get(it) } ?: 0f

                    Card(
                        colors = CardDefaults.cardColors(containerColor = DarkSurface),
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween,
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)
                        ) {
                            // Your starter
                            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
                                Text(
                                    text = fmtPts(yourPts),
                                    color = if (yourPts > oppPts) GreenPrimary else TextSecondary,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 13.sp,
                                    fontFamily = FontFamily.Monospace,
                                    modifier = Modifier.width(36.dp)
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(
                                    text = yourPlayer?.name ?: "Empty",
                                    color = TextPrimary,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Medium,
                                    maxLines = 1
                                )
                            }

                            // Slot Tag
                            Surface(
                                color = DarkSurfaceVariant,
                                shape = RoundedCornerShape(4.dp),
                                modifier = Modifier.padding(horizontal = 4.dp)
                            ) {
                                Text(
                                    text = slot.name,
                                    color = GoldAccent,
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    fontFamily = FontFamily.Monospace,
                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                )
                            }

                            // Opp starter
                            Row(
                                horizontalArrangement = Arrangement.End,
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier.weight(1f)
                            ) {
                                Text(
                                    text = oppPlayer?.name ?: "Empty",
                                    color = TextSecondary,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Medium,
                                    maxLines = 1
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(
                                    text = fmtPts(oppPts),
                                    color = if (oppPts > yourPts) LossColor else TextSecondary,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 13.sp,
                                    fontFamily = FontFamily.Monospace,
                                    modifier = Modifier.width(36.dp),
                                    textAlign = androidx.compose.ui.text.style.TextAlign.End
                                )
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Action: Next Week / Offseason
            Button(
                onClick = onNextWeek,
                colors = ButtonDefaults.buttonColors(containerColor = GreenPrimary),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(50.dp)
                    .testTag("matchup_next_week_button")
            ) {
                Text(
                    text = if (state.week >= LeagueEngine.CHAMPIONSHIP_WEEK) "COMPLETE SEASON & OFFSEASON" else "ADVANCE TO WEEK ${state.week + 1}",
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp,
                    letterSpacing = 0.5.sp
                )
            }
        }
    }
}
