#!/usr/bin/env python3
"""
Script para crear usuarios de prueba en MongoDB local.

Uso:
    python scripts/setup_test_users.py
"""

from pymongo import MongoClient
import sys
import os

# Agregar el directorio backend al path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

MONGO_URI = os.getenv("MONGO_URI", "mongodb://127.0.0.1:27017/red_k")

def main():
    print("🔧 Setup de usuarios de prueba")
    print("=" * 50)
    
    try:
        # Conectar a MongoDB
        print("\n📡 Conectando a MongoDB...")
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
        db = client.get_database("red_k")
        users_col = db["users"]
        
        # Verificar conexión
        client.admin.command('ping')
        print("✅ Conexión exitosa")
        
        # Ver usuarios existentes
        existing_count = users_col.count_documents({})
        print(f"\n📊 Usuarios existentes: {existing_count}")
        
        if existing_count > 0:
            print("\nUsuarios actuales:")
            for user in users_col.find({}, {"username": 1, "email": 1}):
                print(f"  ✓ {user['username']} ({user.get('email', 'sin email')})")
        
        # Usuarios de prueba
        test_users = [
            {
                "username": "rodrigo",
                "email": "rodrigo@mail.com",
                "name": "Rodrigo González",
                "bio": "Desarrollador Full Stack"
            },
            {
                "username": "kam",
                "email": "kam@mail.com",
                "name": "Kamila Torres",
                "bio": "UX Designer"
            },
            {
                "username": "alex",
                "email": "alex@mail.com",
                "name": "Alex Ramírez",
                "bio": "Backend Engineer"
            },
            {
                "username": "test",
                "email": "test@mail.com",
                "name": "Usuario Test",
                "bio": "Usuario de prueba"
            }
        ]
        
        print("\n🔄 Creando/actualizando usuarios de prueba...")
        created = 0
        updated = 0
        
        for user in test_users:
            existing = users_col.find_one({"username": user["username"]})
            
            if existing:
                # Actualizar
                users_col.update_one(
                    {"username": user["username"]},
                    {"$set": user}
                )
                print(f"  ♻️  {user['username']} - actualizado")
                updated += 1
            else:
                # Crear nuevo
                users_col.insert_one(user)
                print(f"  ✨ {user['username']} - creado")
                created += 1
        
        print(f"\n✅ Completado!")
        print(f"   - Creados: {created}")
        print(f"   - Actualizados: {updated}")
        
        # Mostrar resumen final
        final_count = users_col.count_documents({})
        print(f"\n📊 Total de usuarios en la base de datos: {final_count}")
        
        print("\n" + "=" * 50)
        print("🎉 ¡Listo para probar!")
        print("\nAhora puedes:")
        print("  1. Iniciar el backend: uvicorn app.main:app --port 8001 --reload")
        print("  2. Iniciar el frontend: yarn start")
        print("  3. Hacer login con cualquiera de estos usuarios:")
        print()
        for user in test_users:
            print(f"     - Usuario: {user['username']}")
        print()
        print("  Nota: Usa el username como password para testing")
        print("        (La app no valida passwords por ahora)")
        
        client.close()
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        print("\n💡 Soluciones:")
        print("  1. Verifica que MongoDB esté corriendo:")
        print("     docker-compose up -d mongo")
        print("     docker-compose ps")
        print()
        print("  2. Verifica la conexión:")
        print(f"     mongosh {MONGO_URI}")
        print()
        print("  3. Verifica la variable de entorno:")
        print(f"     MONGO_URI={MONGO_URI}")
        sys.exit(1)

if __name__ == "__main__":
    main()
