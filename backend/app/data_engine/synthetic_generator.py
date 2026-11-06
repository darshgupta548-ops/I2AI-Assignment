import os
import numpy as np
import pandas as pd
from pathlib import Path
from datetime import datetime, timedelta

def generate_gujarat_solar_campus(output_path: Path, n_days: int = 180) -> Path:
    """
    Generates synthetic energy dataset for a hypothetical Western India university hostel:
    Features: Hot climate, high cooling load, rooftop solar PV, grid import, occupancy cycles.
    """
    np.random.seed(42)
    start_date = datetime(2024, 1, 1)
    
    records = []
    hostel_blocks = ['Block-A (Junior)', 'Block-B (Senior)', 'Block-C (International)']
    capacities = {'Block-A (Junior)': 320, 'Block-B (Senior)': 280, 'Block-C (International)': 200}
    
    for day in range(n_days):
        current_date = start_date + timedelta(days=day)
        date_str = current_date.strftime("%Y-%m-%d")
        month = current_date.month
        is_weekend = 1 if current_date.weekday() >= 5 else 0
        
        # Seasonal temperature (Gujarat heats up from March to June)
        base_temp = 22.0 if month in [12, 1, 2] else (38.0 if month in [4, 5, 6] else 31.0)
        temp_variation = np.random.normal(0, 2.5)
        temperature_c = round(float(np.clip(base_temp + temp_variation, 16.0, 46.0)), 1)
        
        # Humidity (% - higher in monsoon July-September)
        base_hum = 75.0 if month in [7, 8, 9] else 35.0
        humidity = round(float(np.clip(base_hum + np.random.normal(0, 8.0), 18.0, 95.0)), 1)
        
        for block in hostel_blocks:
            capacity = capacities[block]
            
            # Occupancy fluctuates (drops on weekends, exam breaks)
            occ_rate = 0.65 if is_weekend else 0.92
            if month in [5, 6]: # Summer vacation
                occ_rate = 0.25
            occupancy = int(np.clip(capacity * occ_rate + np.random.normal(0, 10), 20, capacity))
            
            # AC hours per day (scales with temperature and occupancy)
            if temperature_c > 32.0:
                ac_hours_raw = (temperature_c - 30.0) * 1.5 + (occupancy / capacity) * 4.0
            elif temperature_c > 26.0:
                ac_hours_raw = (temperature_c - 26.0) * 0.7 + (occupancy / capacity) * 2.0
            else:
                ac_hours_raw = 0.5
            ac_hours = round(float(np.clip(ac_hours_raw + np.random.normal(0, 0.8), 0.0, 18.0)), 1)
            
            fan_hours = round(float(np.clip(14.0 + np.random.normal(0, 2.0), 2.0, 24.0)), 1)
            lighting_hours = round(float(np.clip(7.5 + np.random.normal(0, 1.2), 3.0, 14.0)), 1)
            
            # Base appliance load (laptops, chargers, water coolers) in kWh
            appliance_usage_kwh = round(float(occupancy * 0.45 + np.random.normal(0, 5.0)), 2)
            
            # Solar generation: strong in summer/spring, lower in monsoon/winter
            solar_potential = 210.0 if month in [3, 4, 5] else (130.0 if month in [7, 8] else 165.0)
            solar_generation_kwh = round(float(max(0.0, solar_potential * (1.0 - (humidity / 180.0)) + np.random.normal(0, 12.0))), 2)
            
            # Total Energy formula with realistic physical sub-components
            # AC unit ~1.5 kW average across block units, fans ~0.08 kW, lighting ~0.05 kW
            ac_energy = ac_hours * (occupancy * 0.08) * 1.4
            fan_energy = fan_hours * (occupancy * 0.06) * 0.08
            lighting_energy = lighting_hours * (occupancy * 0.05) * 0.04
            
            noise = np.random.normal(0, 8.0)
            total_energy_kwh = round(float(max(30.0, appliance_usage_kwh + ac_energy + fan_energy + lighting_energy + noise)), 2)
            
            # Grid import is remainder after on-site solar consumption
            grid_import_kwh = round(float(max(0.0, total_energy_kwh - solar_generation_kwh)), 2)
            
            # Inject a controlled 1.5% missing value noise in humidity/appliance to test data cleaning
            recorded_humidity = humidity if np.random.rand() > 0.02 else np.nan
            recorded_appliance = appliance_usage_kwh if np.random.rand() > 0.015 else np.nan

            records.append({
                "date": date_str,
                "hostel_block": block,
                "occupancy": occupancy,
                "total_capacity": capacity,
                "temperature_c": temperature_c,
                "humidity": recorded_humidity,
                "ac_hours": ac_hours,
                "fan_hours": fan_hours,
                "lighting_hours": lighting_hours,
                "appliance_usage_kwh": recorded_appliance,
                "solar_generation_kwh": solar_generation_kwh,
                "grid_import_kwh": grid_import_kwh,
                "total_energy_kwh": total_energy_kwh
            })

    df = pd.DataFrame(records)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(output_path, index=False)
    return output_path

def generate_himalayan_thermal_campus(output_path: Path, n_days: int = 150) -> Path:
    """
    Generates synthetic energy dataset for a hypothetical North/Himalayan hostel:
    Features: Sub-zero winters, space heating, geyser demand, battery storage, peak tariffs.
    Demonstrates true adaptive profiling on a completely distinct schema.
    """
    np.random.seed(101)
    start_date = datetime(2024, 10, 1)
    
    records = []
    wings = ['North-Wing', 'South-Wing']
    
    for day in range(n_days):
        current_date = start_date + timedelta(days=day)
        timestamp_str = current_date.strftime("%Y-%m-%d")
        
        # Sub-zero and cold mountain temperatures (-5C to +15C)
        outdoor_temp_c = round(float(np.random.normal(2.0, 4.5)), 1)
        heating_degree_days = round(float(max(0.0, 18.0 - outdoor_temp_c)), 2)
        
        for wing in wings:
            residents = int(np.random.choice([110, 125, 130, 140, 145]))
            
            # Heating hours scale heavily with heating degree days
            space_heater_hours = round(float(np.clip(heating_degree_days * 0.8 + np.random.normal(0, 1.2), 1.0, 20.0)), 1)
            water_geyser_hours = round(float(np.clip(residents * 0.05 + np.random.normal(0, 0.8), 2.0, 12.0)), 1)
            kitchen_load_kwh = round(float(residents * 0.65 + np.random.normal(0, 4.0)), 2)
            
            # Battery storage discharge (peak shaving 45-80 kWh)
            battery_discharge_kwh = round(float(np.clip(np.random.normal(55.0, 10.0), 20.0, 90.0)), 2)
            
            # Peak tariff indicator
            peak_tariff_active = 1 if current_date.weekday() < 5 else 0
            
            # Space heating power ~ 1.8kW per active unit
            heating_load = space_heater_hours * (residents * 0.09) * 1.8
            geyser_load = water_geyser_hours * 3.0 * 2.2
            
            total_building_kwh = round(float(kitchen_load_kwh + heating_load + geyser_load + np.random.normal(0, 6.0)), 2)
            
            records.append({
                "timestamp": timestamp_str,
                "wing_id": wing,
                "residents_present": residents,
                "outdoor_temp_c": outdoor_temp_c,
                "heating_degree_days": heating_degree_days,
                "space_heater_hours": space_heater_hours,
                "water_geyser_hours": water_geyser_hours,
                "kitchen_load_kwh": kitchen_load_kwh,
                "battery_discharge_kwh": battery_discharge_kwh,
                "peak_tariff_active": peak_tariff_active,
                "total_building_kwh": total_building_kwh
            })

    df = pd.DataFrame(records)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(output_path, index=False)
    return output_path
