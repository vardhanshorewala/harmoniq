#!/usr/bin/env python3
"""
Generic regulation processor - Process PDFs from any country directory
Creates ChromaDB embeddings and knowledge graphs

Usage:
    python process_regulations.py JAPAN
    python process_regulations.py USA
    python process_regulations.py EU
"""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from app.services.regulation_service import RegulationService


# Country-specific configuration
COUNTRY_CONFIG = {
    "JAPAN": {
        "authority": "PMDA",  # Pharmaceuticals and Medical Devices Agency
        "full_name": "Japan (PMDA)",
    },
    "USA": {
        "authority": "FDA",  # Food and Drug Administration
        "full_name": "United States (FDA)",
    },
    "EU": {
        "authority": "EMA",  # European Medicines Agency
        "full_name": "European Union (EMA)",
    },
}


async def process_regulations(country: str):
    """
    Process all PDFs in data/{country}/ directory
    
    Args:
        country: Country code (JAPAN, USA, EU, etc.)
    """
    
    country = country.upper()
    
    # Get country configuration
    if country not in COUNTRY_CONFIG:
        print(f"⚠️  Unknown country: {country}")
        print(f"   Using default authority name: {country}")
        config = {
            "authority": country,
            "full_name": country,
        }
    else:
        config = COUNTRY_CONFIG[country]
    
    # Initialize paths
    data_dir = Path(f"./data/{country.lower()}")
    graph_dir = data_dir / "graphs"
    chroma_dir = data_dir / "chroma"
    
    # Create directories if they don't exist
    graph_dir.mkdir(parents=True, exist_ok=True)
    chroma_dir.mkdir(parents=True, exist_ok=True)
    
    print("=" * 80)
    print(f"REGULATION PROCESSOR - {config['full_name']}")
    print("=" * 80)
    print(f"Country: {country}")
    print(f"Authority: {config['authority']}")
    print(f"Source directory: {data_dir.absolute()}")
    print(f"Graph output: {graph_dir.absolute()}")
    print(f"ChromaDB output: {chroma_dir.absolute()}")
    print("=" * 80)
    
    # Find all PDFs in directory
    pdf_files = list(data_dir.glob("*.pdf"))
    
    if not pdf_files:
        print(f"\n❌ No PDF files found in {data_dir}/")
        print(f"   Please add regulation PDFs to: {data_dir.absolute()}")
        print(f"\n   Example structure:")
        print(f"   {data_dir}/")
        print(f"   ├── regulation-1.pdf")
        print(f"   ├── regulation-2.pdf")
        print(f"   └── ...")
        return
    
    print(f"\n✓ Found {len(pdf_files)} PDF file(s):\n")
    for pdf in pdf_files:
        print(f"  - {pdf.name} ({pdf.stat().st_size / 1024:.1f} KB)")
    
    # Initialize service
    print("\n" + "=" * 80)
    print(f"Initializing Regulation Service for {country}...")
    print("=" * 80)
    
    service = RegulationService(country=country)
    
    # Process each PDF
    successful = 0
    failed = 0
    
    for i, pdf_path in enumerate(pdf_files, 1):
        print("\n" + "=" * 80)
        print(f"PROCESSING PDF {i}/{len(pdf_files)}: {pdf_path.name}")
        print("=" * 80)
        
        # Extract regulation ID from filename
        file_id = pdf_path.stem  # filename without extension
        regulation_id = f"{config['authority']}-{file_id}"
        
        try:
            # Ingest the regulation
            reg_doc = await service.ingest_regulation(
                pdf_path=str(pdf_path),
                country=country,
                authority=config['authority'],
                title=f"{config['authority']} Regulation {file_id}",
                version="2024"
            )
            
            print(f"\n✅ Successfully processed: {regulation_id}")
            print(f"   - Requirements extracted: {len(reg_doc.clauses)}")
            
            # Save graph for this regulation
            graph_output = graph_dir / f"{regulation_id}.json"
            service.graph_builder.save(str(graph_output))
            print(f"   - Graph saved: {graph_output.name}")
            
            successful += 1
            
        except Exception as e:
            print(f"\n❌ Error processing {pdf_path.name}:")
            print(f"   {str(e)}")
            failed += 1
            
            # Print stack trace for debugging
            import traceback
            print("\n   Stack trace:")
            traceback.print_exc()
            continue
    
    # Print final statistics
    print("\n" + "=" * 80)
    print("PROCESSING COMPLETE")
    print("=" * 80)
    
    print(f"\n📊 Processing Summary:")
    print(f"   - Total PDFs: {len(pdf_files)}")
    print(f"   - Successful: {successful} ✅")
    print(f"   - Failed: {failed} ❌")
    
    if successful > 0:
        stats = service.graph_builder.get_stats()
        print(f"\n📊 Final Knowledge Graph Statistics:")
        print(f"   - Total nodes: {stats['num_nodes']}")
        print(f"   - Total edges: {stats['num_edges']}")
        print(f"   - Edge types:")
        for edge_type, count in stats['edge_types'].items():
            print(f"     • {edge_type}: {count}")
        
        print(f"\n📁 Output Locations:")
        print(f"   - Graphs: {graph_dir.absolute()}")
        print(f"   - ChromaDB: {chroma_dir.absolute()}")
        
        print(f"\n✅ {country} regulations processed successfully!")
        print(f"\nYou can now query them using:")
        print(f'  POST /api/regulations/retrieve')
        print(f'  with country="{country}"')


def main():
    """Main entry point"""
    
    if len(sys.argv) < 2:
        print("Usage: python process_regulations.py <COUNTRY>")
        print("\nExamples:")
        print("  python process_regulations.py JAPAN")
        print("  python process_regulations.py USA")
        print("  python process_regulations.py EU")
        print("\nSupported countries:")
        for country, config in COUNTRY_CONFIG.items():
            print(f"  - {country} ({config['full_name']})")
        sys.exit(1)
    
    country = sys.argv[1].upper()
    
    try:
        asyncio.run(process_regulations(country))
    except KeyboardInterrupt:
        print("\n\n⚠️  Processing interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ Fatal error: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()

