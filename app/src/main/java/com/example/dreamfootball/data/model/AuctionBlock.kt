package com.example.dreamfootball.data.model

import kotlinx.serialization.Serializable

@Serializable
data class BidLog(
    val teamId: String,
    val amount: Int
)

@Serializable
data class AuctionBlock(
    val playerId: String,
    val nominatorId: String,
    val highBid: Int,
    val highBidderId: String,
    val going: Int = 0, // 0 = On the block, 1 = Going once, 2 = Going twice
    val waitingForHuman: Boolean = false,
    val passedTeamIds: List<String> = emptyList(),
    val log: List<BidLog> = emptyList()
)

enum class AuctionPlan(val id: String, val label: String, val description: String) {
    BALANCED("balanced", "Balanced", "Anchor one star, fill starter slots evenly with high floors."),
    HERO_RB("hero_rb", "Hero RB", "Aggressively bid on an elite RB1, then draft bargain WRs."),
    DUAL_ACE_WR("dual_ace_wr", "Dual Ace WR", "Secure two top-tier wideouts for heavy PPR volume."),
    BUDGET_QB("budget_qb", "Budget QB", "Wait on quarterback value; spend aggressively on skill talent."),
    VALUE_HOUND("value_hound", "Value Hound", "Pounce only when bids land significantly below consensus.")
}
