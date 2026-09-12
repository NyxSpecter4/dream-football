package com.example.dreamfootball.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
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
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.FastForward
import androidx.compose.material.icons.filled.Gavel
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.dreamfootball.data.model.GameState
import com.example.dreamfootball.data.model.Player
import com.example.dreamfootball.data.model.Position
import com.example.dreamfootball.data.model.Roster
import com.example.dreamfootball.domain.AuctionEngine
import com.example.dreamfootball.domain.PlayersData
import com.example.dreamfootball.domain.ScoringEngine
import com.example.dreamfootball.ui.components.JerseyBadge
import com.example.dreamfootball.ui.components.PlayerAvatar
import com.example.dreamfootball.ui.components.PlayerRow
import com.example.dreamfootball.ui.components.PositionChip
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
import kotlin.math.max

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun AuctionScreen(
    state: GameState,
    onNominate: (playerId: String, openingBid: Int) -> Unit,
    onBid: (amount: Int) -> Unit,
    onPass: () -> Unit,
    onCpuStep: () -> Unit,
    onAutoFill: () -> Unit
) {
    val userBudget = state.budgets["you"] ?: AuctionEngine.SALARY_CAP
    val userRoster = state.rosters["you"] ?: Roster()
    val spotsLeft = userRoster.spotsLeft()
    val maxAffordable = AuctionEngine.maxAffordable(userBudget, spotsLeft)

    val currentNominator = state.teams.getOrNull(state.nominateIndex)
    val isUserTurnToNominate = currentNominator?.human == true && state.block == null

    var selectedFilter by remember { mutableStateOf<Position?>(null) }

    TurfFieldBackground {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp)
        ) {
            // Top Bar: Cap and Roster Status
            Card(
                colors = CardDefaults.cardColors(containerColor = DarkSurface),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .border(1.dp, DarkSurfaceBorder, RoundedCornerShape(12.dp))
            ) {
                Row(
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp)
                ) {
                    Column {
                        Text(
                            text = "CAP SPACE",
                            color = TextMuted,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 0.5.sp
                        )
                        Text(
                            text = fmtMoney(userBudget),
                            color = GreenPrimary,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace
                        )
                    }

                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = "SPOTS LEFT",
                            color = TextMuted,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 0.5.sp
                        )
                        Text(
                            text = "$spotsLeft / 10",
                            color = TextPrimary,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace
                        )
                    }

                    Column(horizontalAlignment = Alignment.End) {
                        Text(
                            text = "MAX BID",
                            color = TextMuted,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 0.5.sp
                        )
                        Text(
                            text = fmtMoney(maxAffordable),
                            color = GoldAccent,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Main Draft Area
            if (state.block != null) {
                val block = state.block
                val player = PlayersData.getPlayer(block.playerId)
                val highBidderTeam = state.teams.find { it.id == block.highBidderId }
                val isHighBidder = block.highBidderId == "you"
                val hasPassed = block.passedTeamIds.contains("you")

                // Active Block Card
                Card(
                    colors = CardDefaults.cardColors(containerColor = DarkSurface),
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(1.5.dp, if (isHighBidder) GreenPrimary else DarkSurfaceBorder, RoundedCornerShape(14.dp))
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        // Hammer Stage Banner
                        val stageLabel = when (block.going) {
                            0 -> "ON THE BLOCK"
                            1 -> "GOING ONCE..."
                            else -> "GOING TWICE..."
                        }
                        val stageColor = when (block.going) {
                            0 -> GreenPrimary
                            1 -> GoldAccent
                            else -> LossColor
                        }

                        Row(
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    imageVector = Icons.Default.Gavel,
                                    contentDescription = null,
                                    tint = stageColor,
                                    modifier = Modifier.size(16.dp)
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(
                                    text = stageLabel,
                                    color = stageColor,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    fontFamily = FontFamily.Monospace
                                )
                            }
                            if (isHighBidder) {
                                Surface(
                                    color = GreenPrimary.copy(alpha = 0.2f),
                                    shape = RoundedCornerShape(6.dp)
                                ) {
                                    Text(
                                        text = "YOUR HIGH BID",
                                        color = GreenPrimary,
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Bold,
                                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                    )
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(12.dp))

                        // Player Info Row
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            PlayerAvatar(player = player, modifier = Modifier.size(44.dp))
                            Spacer(modifier = Modifier.width(12.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text(
                                        text = player.name,
                                        color = TextPrimary,
                                        fontSize = 18.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                    Spacer(modifier = Modifier.width(6.dp))
                                    PositionChip(pos = player.pos)
                                }
                                Text(
                                    text = "${player.nfl} · Bye ${player.bye} · OVR ${player.ovr} · Proj ${fmtPts(ScoringEngine.calculateProjection(player).mid)}",
                                    color = TextMuted,
                                    fontSize = 12.sp,
                                    fontFamily = FontFamily.Monospace
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(16.dp))

                        // High Bid Row
                        Row(
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(8.dp))
                                .background(DarkSurfaceVariant)
                                .padding(horizontal = 12.dp, vertical = 8.dp)
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                if (highBidderTeam != null) {
                                    JerseyBadge(jersey = highBidderTeam.jersey, sizeDp = 12)
                                    Spacer(modifier = Modifier.width(8.dp))
                                }
                                Text(
                                    text = highBidderTeam?.short ?: "BIDDER",
                                    color = TextSecondary,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 13.sp
                                )
                            }
                            Text(
                                text = fmtMoney(block.highBid),
                                color = GoldAccent,
                                fontWeight = FontWeight.Bold,
                                fontSize = 18.sp,
                                fontFamily = FontFamily.Monospace
                            )
                        }

                        Spacer(modifier = Modifier.height(16.dp))

                        // Bid Controls
                        val next1k = block.highBid + AuctionEngine.BID_STEP
                        val next5k = block.highBid + 5_000
                        val canBid1k = !hasPassed && next1k <= maxAffordable && !isHighBidder
                        val canBid5k = !hasPassed && next5k <= maxAffordable && !isHighBidder

                        Row(modifier = Modifier.fillMaxWidth()) {
                            Button(
                                onClick = { onBid(next1k) },
                                enabled = canBid1k,
                                colors = ButtonDefaults.buttonColors(containerColor = GreenPrimary),
                                shape = RoundedCornerShape(8.dp),
                                modifier = Modifier
                                    .weight(1f)
                                    .height(44.dp)
                                    .testTag("bid_1k_button")
                            ) {
                                Text("+1K (${fmtMoney(next1k)})", fontWeight = FontWeight.Bold, fontSize = 12.sp)
                            }
                            Spacer(modifier = Modifier.width(8.dp))
                            Button(
                                onClick = { onBid(next5k) },
                                enabled = canBid5k,
                                colors = ButtonDefaults.buttonColors(containerColor = GoldAccent),
                                shape = RoundedCornerShape(8.dp),
                                modifier = Modifier
                                    .weight(1f)
                                    .height(44.dp)
                                    .testTag("bid_5k_button")
                            ) {
                                Text("+5K (${fmtMoney(next5k)})", fontWeight = FontWeight.Bold, fontSize = 12.sp, color = DarkBg)
                            }
                            Spacer(modifier = Modifier.width(8.dp))
                            OutlinedButton(
                                onClick = onPass,
                                enabled = !hasPassed && !isHighBidder,
                                shape = RoundedCornerShape(8.dp),
                                modifier = Modifier
                                    .weight(0.8f)
                                    .height(44.dp)
                                    .testTag("pass_button")
                            ) {
                                Text(if (hasPassed) "PASSED" else "PASS", fontSize = 12.sp, color = LossColor)
                            }
                        }

                        Spacer(modifier = Modifier.height(10.dp))

                        // Step Auction Hammer Button
                        Button(
                            onClick = onCpuStep,
                            colors = ButtonDefaults.buttonColors(containerColor = DarkSurfaceVariant),
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(40.dp)
                                .testTag("step_auction_button")
                        ) {
                            Icon(imageVector = Icons.Default.FastForward, contentDescription = null, tint = TextPrimary, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("ADVANCE CLOCK / STEP", color = TextPrimary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                        }
                    }
                }
            } else {
                // No active block - Nomination Mode
                Card(
                    colors = CardDefaults.cardColors(containerColor = DarkSurface),
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(1.dp, if (isUserTurnToNominate) GreenPrimary else DarkSurfaceBorder, RoundedCornerShape(14.dp))
                        .padding(14.dp)
                ) {
                    Column {
                        Row(
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column {
                                Text(
                                    text = if (isUserTurnToNominate) "YOUR TURN TO NOMINATE" else "ON THE CLOCK: ${currentNominator?.name ?: "CPU"}",
                                    color = if (isUserTurnToNominate) GreenPrimary else TextSecondary,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold,
                                    fontFamily = FontFamily.Monospace
                                )
                                Text(
                                    text = if (isUserTurnToNominate) "Select a player from pool below" else "Tap Step to let CPU nominate",
                                    color = TextMuted,
                                    fontSize = 11.sp
                                )
                            }

                            if (!isUserTurnToNominate) {
                                Button(
                                    onClick = onCpuStep,
                                    colors = ButtonDefaults.buttonColors(containerColor = GreenPrimary),
                                    shape = RoundedCornerShape(8.dp),
                                    modifier = Modifier.testTag("cpu_nominate_step_button")
                                ) {
                                    Text("CPU NOMINATE", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Auto-Fill Button & Filter Tabs
            Row(
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    text = "PLAYER POOL",
                    color = TextSecondary,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace,
                    letterSpacing = 1.sp
                )

                OutlinedButton(
                    onClick = onAutoFill,
                    shape = RoundedCornerShape(6.dp),
                    modifier = Modifier.testTag("auto_fill_draft_button")
                ) {
                    Icon(imageVector = Icons.Default.Bolt, contentDescription = null, tint = GoldAccent, modifier = Modifier.size(14.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("AUTO-FILL AT $1K", color = GoldAccent, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Position Filters
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                val isAll = selectedFilter == null
                Surface(
                    color = if (isAll) GreenPrimary else DarkSurface,
                    shape = RoundedCornerShape(6.dp),
                    modifier = Modifier
                        .border(1.dp, if (isAll) GreenPrimary else DarkSurfaceBorder, RoundedCornerShape(6.dp))
                        .clickable { selectedFilter = null }
                ) {
                    Text(
                        text = "ALL",
                        color = if (isAll) DarkBg else TextSecondary,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                    )
                }
                Position.entries.forEach { pos ->
                    val selected = selectedFilter == pos
                    Surface(
                        color = if (selected) GreenPrimary else DarkSurface,
                        shape = RoundedCornerShape(6.dp),
                        modifier = Modifier
                            .border(1.dp, if (selected) GreenPrimary else DarkSurfaceBorder, RoundedCornerShape(6.dp))
                            .clickable { selectedFilter = pos }
                    ) {
                        Text(
                            text = pos.name,
                            color = if (selected) DarkBg else TextSecondary,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Filtered Player Pool List
            val takenPlayerIds = remember(state.contracts) {
                state.contracts.map { it.playerId }.toSet()
            }
            val availablePlayers = remember(takenPlayerIds, selectedFilter) {
                PlayersData.ALL_PLAYERS.filter {
                    !takenPlayerIds.contains(it.id) && (selectedFilter == null || it.pos == selectedFilter)
                }.sortedByDescending { it.ovr }
            }

            LazyColumn(
                verticalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.weight(1f)
            ) {
                items(availablePlayers, key = { it.id }) { player ->
                    PlayerRow(
                        player = player,
                        trailingText = if (isUserTurnToNominate) "NOMINATE" else null,
                        onClick = {
                            if (isUserTurnToNominate) {
                                onNominate(player.id, AuctionEngine.MIN_BID)
                            }
                        }
                    )
                }
            }
        }
    }
}
