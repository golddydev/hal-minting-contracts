# Overview

This project enables users to mint HAL NFTs among pre-defined 10,000 NFTs.

> Project's Story

There are 10,000 pre-defined HAL NFTs.

When user requests mint, they will be given one asset name (which is not minted already).

But in the first transaction (when user request minting), users couldn't see anything about HAL NFT's datum.
(Because that is requesting order, not minting.)

Minting will be done by authorized batchers.

`Why is this necessary?`

Because, if users can see datum in minting transaction (when they sign transaction using wallet), it opens possibility for them to assess the datums and choose their favorite one.

And to prevent this, we just use empty datum in initial minting transaction, and immediately updates metadata to correct one.

## White-listed Users

We will have white listed users who will have early access to HAL NFT minting.

1. OG Handle Holders

They have 2 hours early access

2. Ultra rare holders

They have 1 hour early access

## Smart Contract

[Smart Contract Specification](https://github.com/golddydev/hal-mint/blob/main/smart-contract/smart-contract-spec.md)
