import sqlite3
c = sqlite3.connect(r'e:\Downloads\DockIQ\backend\dockiq.db')
c.execute("UPDATE orders SET status='in_progress', completed_at=NULL, seal_number=NULL WHERE status='complete'")
c.execute("UPDATE order_items SET actual_quantity=0, verified=0")
c.execute("UPDATE dock_doors SET status='active', lifecycle_phase='loading' WHERE id IN (1,2,5,9)")
c.execute("UPDATE dock_doors SET status='active', lifecycle_phase='unloading' WHERE id IN (3,6,7,10)")
c.commit()
print("Database reset done")
for r in c.execute("SELECT id,order_number,type,operator_id,status FROM orders").fetchall():
    print(r)
