"""
Cognee AI Copilot — GraphRAG Reasoning Engine
==============================================
Uses Cognee with local Ollama (Phi-3) to ingest the credit dataset
into a Knowledge Graph and answer natural language questions about
borrower risk, connections, and fraud patterns.
"""

import os
import asyncio
import pandas as pd
from pathlib import Path

# Set Cognee environment BEFORE importing cognee
os.environ.setdefault("LLM_PROVIDER", "ollama")
os.environ.setdefault("LLM_MODEL", "phi3.5")
os.environ.setdefault("LLM_ENDPOINT", "http://localhost:11434/v1")
os.environ.setdefault("LLM_API_KEY", "ollama")

os.environ.setdefault("EMBEDDING_PROVIDER", "ollama")
os.environ.setdefault("EMBEDDING_MODEL", "nomic-embed-text:latest")
os.environ.setdefault("EMBEDDING_ENDPOINT", "http://localhost:11434/api/embed")
os.environ.setdefault("EMBEDDING_DIMENSIONS", "768")

import cognee

# Track ingestion state
_ingested = False
_ingestion_error = None


async def ingest_credit_data(df: pd.DataFrame):
    """
    Ingest credit dataset into Cognee's knowledge graph.
    Converts key columns into textual descriptions that Cognee can
    parse into entities and relationships.
    """
    global _ingested, _ingestion_error

    try:
        print("  [Copilot] Resetting Cognee state...")
        await cognee.prune.prune_data()
        await cognee.prune.prune_system(metadata=True)

        # Build textual summaries for each borrower
        # Cognee works best with natural language descriptions
        print(f"  [Copilot] Preparing {len(df)} borrower profiles for ingestion...")

        # Process in batches to avoid overwhelming Ollama
        batch_size = 100
        total = min(len(df), 500)  # Limit to 500 for initial ingestion speed

        for start in range(0, total, batch_size):
            end = min(start + batch_size, total)
            batch_texts = []

            for i in range(start, end):
                row = df.iloc[i]
                name = row.get('full_name', f'Borrower {i}')
                credit_score = row.get('credit_score', 'N/A')
                is_default = 'Yes' if row.get('default', 0) == 1 else 'No'
                employer = row.get('employer_name', 'Unknown')
                employer_id = row.get('employer_id', 'Unknown')
                city = row.get('city', 'Unknown')
                state = row.get('state', 'Unknown')
                zip_code = row.get('zip_code', 'Unknown')
                device_id = row.get('device_id', 'Unknown')
                ip_address = row.get('ip_address', 'Unknown')
                income = row.get('monthly_income', 'N/A')
                dti = row.get('debt_to_income_ratio', 'N/A')
                loan_amount = row.get('loan_amount', 'N/A')
                loan_purpose = row.get('loan_purpose', 'N/A')
                num_defaults = row.get('num_past_defaults', 0)
                late_30 = row.get('num_late_payments_30d', 0)
                late_60 = row.get('num_late_payments_60d', 0)
                late_90 = row.get('num_late_payments_90d', 0)

                text = (
                    f"Borrower Row #{i}: {name}. "
                    f"Credit Score: {credit_score}. Defaulted: {is_default}. "
                    f"Works at {employer} (Employer ID: {employer_id}). "
                    f"Located in {city}, {state}, Zip Code: {zip_code}. "
                    f"Device ID: {device_id}. IP Address: {ip_address}. "
                    f"Monthly Income: {income}. Debt-to-Income Ratio: {dti}. "
                    f"Loan Amount: {loan_amount}. Loan Purpose: {loan_purpose}. "
                    f"Past Defaults: {num_defaults}. Late Payments (30d: {late_30}, 60d: {late_60}, 90d: {late_90})."
                )
                batch_texts.append(text)

            # Add the batch as a single document
            combined = "\n\n".join(batch_texts)
            await cognee.add(combined, dataset_name="credit_borrowers")
            print(f"  [Copilot] Added borrowers {start}-{end-1}")

        # Process into knowledge graph
        print("  [Copilot] Running cognify (building knowledge graph)... This may take a few minutes.")
        await cognee.cognify()

        _ingested = True
        _ingestion_error = None
        print("  [Copilot] ✓ Knowledge graph ready!")

    except Exception as e:
        _ingestion_error = str(e)
        _ingested = False
        print(f"  [Copilot] ✗ Ingestion failed: {e}")


async def ask_copilot(query: str, node_id: int = None, df: pd.DataFrame = None) -> dict:
    """
    Ask the AI Copilot a question. If a node_id is provided,
    context about that specific borrower is prepended to the query.
    """
    if not _ingested:
        # If Cognee isn't ready, provide a helpful fallback
        if _ingestion_error:
            return {
                "answer": f"⚠ The AI Knowledge Graph is still initializing. Error: {_ingestion_error}. Please ensure Ollama is running with phi3 and nomic-embed-text models.",
                "status": "error",
            }
        return {
            "answer": "⏳ The AI Knowledge Graph is still being built. Please wait a moment and try again.",
            "status": "loading",
        }

    try:
        # If a specific borrower is selected, enrich the query
        enriched_query = query
        if node_id is not None and df is not None and node_id < len(df):
            row = df.iloc[node_id]
            name = row.get('full_name', f'Borrower {node_id}')
            enriched_query = (
                f"Regarding Borrower Row #{node_id} ({name}), "
                f"who has a credit score of {row.get('credit_score', 'N/A')} "
                f"and works at {row.get('employer_name', 'Unknown')}: {query}"
            )

        # Search the knowledge graph
        results = await cognee.search(
            query_text=enriched_query,
            query_type=cognee.SearchType.GRAPH_COMPLETION,
        )

        # Format the response
        if results and len(results) > 0:
            # Cognee returns a list of results; combine the best ones
            answer = str(results[0]) if results else "No relevant information found."
        else:
            answer = "I could not find relevant information in the knowledge graph for that query."

        return {
            "answer": answer,
            "status": "success",
            "node_id": node_id,
        }

    except Exception as e:
        return {
            "answer": f"Error querying the knowledge graph: {str(e)}",
            "status": "error",
        }


def get_copilot_status() -> dict:
    """Return current status of the Cognee copilot."""
    return {
        "ingested": _ingested,
        "error": _ingestion_error,
        "provider": "ollama",
        "model": "phi3.5",
        "embedding_model": "nomic-embed-text",
    }
