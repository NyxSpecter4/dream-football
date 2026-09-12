package com.example.dreamfootball.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.SwapHoriz
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.dreamfootball.data.model.GameState
import com.example.dreamfootball.data.model.Player
import com.example.dreamfootball.data.model.Position
import com.example.dreamfootball.data.model.Roster
import com.example.dreamfootball.data.model.Slot
import com.example.dreamfootball.domain.PlayersData
import com.example.dreamfootball.domain.ScoringEngine
import com.example.dreamfootball.ui.components.PlayerAvatar
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
import com.example.dreamfootball.ui.theme.TextMuted
import com.example.dreamfootball.ui.theme.TextPrimary
import com.example.dreamfootball.ui.theme.TextSecondary

@Composable
fun RosterScreen(
    state: GameState,
    onBack: () -> Unit,
    onSwap: (slot: Slot, benchPlayerId: String) -> Unit,
    onWaiverClaim: (dropPlayerId: String, addPlayerId: String) -> Unit
) {
    val roster = state.rosters["you"] ?: Roster()
    var selectedStarterSlot by remember { mutableStateOf<Slot?>(null) }
    var showWaivers by remember { mutableStateOf(false) }

    TurfFieldBackground {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp)
        ) {
            // Header
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    IconButton(onClick = onBack, modifier = Modifier.testTag("roster_back_button")) {
                        Icon(imageVector = Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = TextPrimary)
                    }
                    Spacer(modifier = Modifier.width(6.dp))
                    Column {
                        Text(
                            text = "ROSTER & LINEUP",
                            color = TextPrimary,
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = if (selectedStarterSlot != null) "Select bench player to swap into $selectedStarterSlot" else "Tap starter to swap with bench",
                            color = if (selectedStarterSlot != null) GoldAccent else TextMuted,
                            fontSize = 11.sp
                        )
                    }
                }

                Button(
                    onClick = { showWaivers = !showWaivers },
                    colors = ButtonDefaults.buttonColors(containerColor = if (showWaivers) GoldAccent else DarkSurfaceVariant),
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier.testTag("toggle_waivers_button")
                ) {
                    Text(
                        text = if (showWaivers) "ROSTER" else "WAIVERS",
                        color = if (showWaivers) DarkBg else TextPrimary,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            if (showWaivers) {
                // Free Agent Waiver Wire
                val signedIds = remember(state.contracts) { state.contracts.map { it.playerId }.toSet() }
                val freeAgents = remember(signedIds) {
                    PlayersData.ALL_PLAYERS.filter { !signedIds.contains(it.id) }.sortedByDescending { it.ovr }
                }

                Text(
                    text = "AVAILABLE FREE AGENTS",
                    color = GoldAccent,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace,
                    letterSpacing = 1.sp
                )
                Spacer(modifier = Modifier.height(8.dp))

                LazyColumn(
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    items(freeAgents) { player ->
                        val proj = ScoringEngine.calculateProjection(player)
                        Card(
                            colors = CardDefaults.cardColors(containerColor = DarkSurface),
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .border(1.dp, DarkSurfaceBorder, RoundedCornerShape(10.dp))
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween,
                                modifier = Modifier.padding(12.dp)
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    PlayerAvatar(player = player)
                                    Spacer(modifier = Modifier.width(10.dp))
                                    Column {
                                        Row(verticalAlignment = Alignment.CenterVertically) {
                                            Text(player.name, color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                                            Spacer(modifier = Modifier.width(6.dp))
                                            PositionChip(pos = player.pos)
                                        }
                                        Text("${player.nfl} · Bye ${player.bye} · ${fmtPts(proj.mid)} proj", color = TextMuted, fontSize = 11.sp)
                                    }
                                }

                                if (roster.bench.isNotEmpty()) {
                                    val dropTarget = roster.bench.first()
                                    Button(
                                        onClick = { onWaiverClaim(dropTarget, player.id) },
                                        colors = ButtonDefaults.buttonColors(containerColor = GreenPrimary),
                                        shape = RoundedCornerShape(6.dp)
                                    ) {
                                        Text("CLAIM", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                    }
                                }
                            }
                        }
                    }
                }
            } else {
                // Lineup and Bench Slots
                LazyColumn(
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    item {
                        Text(
                            text = "STARTERS",
                            color = GreenPrimary,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace,
                            letterSpacing = 1.sp
                        )
                    }

                    items(Slot.entries.toTypedArray()) { slot ->
                        val playerId = roster.lineup[slot]
                        val isSelected = selectedStarterSlot == slot
                        val player = playerId?.let { PlayersData.getPlayer(it) }

                        Surface(
                            color = if (isSelected) DarkSurfaceVariant else DarkSurface,
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .border(
                                    width = if (isSelected) 1.5.dp else 1.dp,
                                    color = if (isSelected) GoldAccent else DarkSurfaceBorder,
                                    shape = RoundedCornerShape(10.dp)
                                )
                                .clickable {
                                    selectedStarterSlot = if (isSelected) null else slot
                                }
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween,
                                modifier = Modifier.padding(12.dp)
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Surface(
                                        color = DarkSurfaceVariant,
                                        shape = RoundedCornerShape(6.dp),
                                        modifier = Modifier.width(44.dp)
                                    ) {
                                        Text(
                                            text = slot.name,
                                            color = if (isSelected) GoldAccent else GreenPrimary,
                                            fontSize = 11.sp,
                                            fontWeight = FontWeight.Bold,
                                            fontFamily = FontFamily.Monospace,
                                            textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                                            modifier = Modifier.padding(vertical = 4.dp)
                                        )
                                    }
                                    Spacer(modifier = Modifier.width(12.dp))

                                    if (player != null) {
                                        Column {
                                            Row(verticalAlignment = Alignment.CenterVertically) {
                                                Text(player.name, color = TextPrimary, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                                                Spacer(modifier = Modifier.width(6.dp))
                                                Text(player.nfl, color = TextMuted, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                                            }
                                            val proj = ScoringEngine.calculateProjection(player)
                                            Text(
                                                text = "${fmtPts(proj.mid)} proj · Bye ${player.bye}",
                                                color = TextSecondary,
                                                fontSize = 11.sp,
                                                fontFamily = FontFamily.Monospace
                                            )
                                        }
                                    } else {
                                        Text("EMPTY SLOT", color = TextMuted, fontSize = 13.sp, fontFamily = FontFamily.Monospace)
                                    }
                                }

                                if (isSelected) {
                                    Icon(imageVector = Icons.Default.SwapHoriz, contentDescription = null, tint = GoldAccent)
                                }
                            }
                        }
                    }

                    item {
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "BENCH",
                            color = TextSecondary,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace,
                            letterSpacing = 1.sp
                        )
                    }

                    items(roster.bench) { benchId ->
                        val player = PlayersData.getPlayer(benchId)
                        val proj = ScoringEngine.calculateProjection(player)
                        val canSwap = selectedStarterSlot != null

                        Surface(
                            color = if (canSwap) DarkSurfaceVariant else DarkSurface,
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .border(
                                    width = if (canSwap) 1.dp else 1.dp,
                                    color = if (canSwap) GreenPrimary else DarkSurfaceBorder,
                                    shape = RoundedCornerShape(10.dp)
                                )
                                .clickable {
                                    if (selectedStarterSlot != null) {
                                        onSwap(selectedStarterSlot!!, benchId)
                                        selectedStarterSlot = null
                                    }
                                }
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween,
                                modifier = Modifier.padding(12.dp)
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    PlayerAvatar(player = player)
                                    Spacer(modifier = Modifier.width(10.dp))
                                    Column {
                                        Row(verticalAlignment = Alignment.CenterVertically) {
                                            Text(player.name, color = TextPrimary, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                                            Spacer(modifier = Modifier.width(6.dp))
                                            PositionChip(pos = player.pos)
                                        }
                                        Text(
                                            text = "${player.nfl} · Bye ${player.bye} · ${fmtPts(proj.mid)} proj",
                                            color = TextMuted,
                                            fontSize = 11.sp,
                                            fontFamily = FontFamily.Monospace
                                        )
                                    }
                                }

                                if (canSwap) {
                                    Text(
                                        text = "TAP TO SWAP",
                                        color = GreenPrimary,
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold,
                                        fontFamily = FontFamily.Monospace
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
